import { StatusResult, ProviderStatus } from '@/lib/types';
import { getDb } from '@/lib/db/firestore';
import { log } from '@/lib/utils/logger';
import { FieldValue } from 'firebase-admin/firestore';
import { buildUnsubscribeUrl } from '@/lib/utils/unsubscribe-token';
import { appIdForProvider } from '@/lib/casual/app-lookup';

export class NotificationService {
    async notifyStatusChange(
        current: StatusResult,
        previous: StatusResult
    ): Promise<void> {
        if (current.status === previous.status) return;
        // "unknown" is our fetch failing, never the provider's state.
        if (current.status === 'unknown' || previous.status === 'unknown') return;

        const changeType = this.getChangeType(current.status, previous.status);
        if (!changeType) return;

        log('info', 'Processing status change notification', {
            provider: current.id,
            change: `${previous.status} -> ${current.status}`,
            type: changeType,
        });

        await Promise.all([
            this.queueEmailNotifications(current, previous, changeType),
            this.sendWebhooks(current, previous, changeType),
        ]);
    }

    private getChangeType(
        current: ProviderStatus,
        previous: ProviderStatus
    ): 'incident' | 'recovery' | 'degradation' | null {
        const rank = (status: ProviderStatus) => {
            switch (status) {
                case 'operational':
                    return 0;
                case 'maintenance':
                    return 1;
                case 'degraded':
                case 'partial_outage':
                    return 2;
                case 'down':
                case 'major_outage':
                    return 3;
                default:
                    return 1;
            }
        };

        const currentRank = rank(current);
        const previousRank = rank(previous);

        if (currentRank === previousRank) return null;
        if (currentRank < previousRank) return 'recovery';
        if (current === 'down' || current === 'major_outage') return 'incident';
        return 'degradation';
    }

    private async queueEmailNotifications(
        current: StatusResult,
        previous: StatusResult,
        type: string
    ) {
        const db = getDb();
        const batch = db.batch();
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';

        // Get active subscriptions
        const snapshot = await db
            .collection('emailSubscriptions')
            .where('active', '==', true)
            .get();

        let count = 0;
        snapshot.forEach((doc) => {
            const sub = doc.data();
            const interestedInProvider =
                !sub.providers ||
                sub.providers.length === 0 ||
                sub.providers.includes(current.id);
            const interestedInType =
                !sub.types || sub.types.includes(type);

            if (interestedInProvider && interestedInType) {
                const ref = db.collection('emailQueue').doc();
                batch.set(ref, {
                    to: sub.email,
                    template: 'status_change',
                    data: {
                        providerName: current.displayName || current.name,
                        providerId: current.id,
                        previousStatus: previous.status,
                        currentStatus: current.status,
                        type,
                        timestamp: new Date().toISOString(),
                        statusPageUrl: current.statusPageUrl || '',
                        appUrl: `${siteUrl}/${appIdForProvider(current.id)}`,
                        unsubscribeUrl: buildUnsubscribeUrl(siteUrl, sub.email),
                    },
                    status: 'pending',
                    createdAt: new Date(),
                });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            log('info', `Queued ${count} email notifications`);
        }
    }

    private async sendWebhooks(
        current: StatusResult,
        previous: StatusResult,
        type: string
    ) {
        const db = getDb();
        const snapshot = await db.collection('webhooks').get();
        const maxFailures = (() => {
            const raw = parseInt(process.env.WEBHOOK_MAX_FAILURES || '', 10);
            return Number.isFinite(raw) && raw > 0 ? raw : 3;
        })();

        const payload = {
            version: '1.0',
            event: type,
            provider: {
                id: current.id,
                name: current.name,
                previousStatus: previous.status,
                currentStatus: current.status,
            },
            timestamp: new Date().toISOString(),
        };

        const deliveries: Promise<void>[] = [];

        snapshot.forEach((doc) => {
            const hook = doc.data();
            if (!hook.url || hook.active === false) return;

            const interestedInProvider =
                !hook.providers ||
                hook.providers.length === 0 ||
                hook.providers.includes(current.id);
            const interestedInType =
                !hook.types ||
                hook.types.length === 0 ||
                hook.types.includes(type);
            if (!interestedInProvider || !interestedInType) return;

            // Delivery Tracing
            log('info', `DELIVERY_START: Webhook to ${hook.url}`, { provider: current.id, type });

            deliveries.push(
                (async () => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10_000);
                    const currentFailures = typeof hook.failureCount === 'number' ? hook.failureCount : 0;
                    let failureReason: string | null = null;
                    let failureStatus: number | null = null;

                    try {
                        const res = await fetch(hook.url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                            signal: controller.signal,
                        });

                        if (res.ok) {
                            log('info', `DELIVERY_SUCCESS: Webhook to ${hook.url}`);
                            await doc.ref.set(
                                {
                                    lastSuccessAt: FieldValue.serverTimestamp(),
                                    failureCount: 0,
                                    lastFailureAt: null,
                                    lastFailureReason: null,
                                    lastFailureStatus: null,
                                },
                                { merge: true }
                            );
                        } else {
                            log('error', `DELIVERY_FAILED: Webhook to ${hook.url}`, { status: res.status });
                            failureReason = `http_${res.status}`;
                            failureStatus = res.status;
                        }
                    } catch (err: any) {
                        log('error', `DELIVERY_ERROR: Webhook to ${hook.url}`, { error: err.message });
                        failureReason = err?.message || 'unknown_error';
                    } finally {
                        clearTimeout(timeoutId);
                    }

                    if (failureReason) {
                        const nextFailureCount = currentFailures + 1;
                        const shouldDisable = nextFailureCount >= maxFailures;

                        await doc.ref.set(
                            {
                                lastFailureAt: FieldValue.serverTimestamp(),
                                lastFailureReason: failureReason,
                                lastFailureStatus: failureStatus,
                                failureCount: FieldValue.increment(1),
                                ...(shouldDisable
                                    ? {
                                          active: false,
                                          disabledAt: FieldValue.serverTimestamp(),
                                          disabledReason: 'auto-disabled-after-failures',
                                      }
                                    : {}),
                            },
                            { merge: true }
                        );

                        if (shouldDisable) {
                            log('warn', `Webhook auto-disabled after failures: ${hook.url}`, {
                                failures: nextFailureCount,
                            });
                        }
                    }
                })()
            );
        });

        if (deliveries.length > 0) {
            await Promise.all(deliveries);
        } else {
            log('info', 'No active webhooks registered for this event');
        }
    }
}

export const notificationService = new NotificationService();
