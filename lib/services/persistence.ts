import { StatusResult, StatusHistoryRecord, ProviderStatus } from '@/lib/types';
import { getDb } from '@/lib/db/firestore';
import { log } from '@/lib/utils/logger';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const STATUS_HISTORY_TTL_DAYS = 30;

export class PersistenceService {
    async saveStatus(result: StatusResult): Promise<void> {
        try {
            const db = getDb();
            await db.collection('status_history').add({
                ...result,
                checkedAt: Timestamp.fromDate(new Date(result.lastChecked)),
                createdAt: FieldValue.serverTimestamp(),
                // Firestore TTL deletes this row once expiresAt passes. Only the
                // most recent rows are ever read, so history beyond a month is
                // pure storage cost.
                expiresAt: Timestamp.fromDate(new Date(Date.now() + STATUS_HISTORY_TTL_DAYS * 86400_000)),
            });
        } catch (error) {
            log('error', 'Failed to save status', { error, providerId: result.id });
        }
    }

    async getLastStatus(providerId: string): Promise<StatusResult | null> {
        try {
            const db = getDb();
            const snapshot = await db.collection('status_history')
                .where('id', '==', providerId)
                .orderBy('checkedAt', 'desc')
                .limit(1)
                .get();

            if (snapshot.empty) return null;

            const data = snapshot.docs[0].data();
            return {
                id: data.id,
                name: data.name,
                status: data.status as ProviderStatus,
                responseTime: data.responseTime,
                lastChecked: data.checkedAt.toDate().toISOString(),
                error: data.error,
                statusPageUrl: data.statusPageUrl
            };
        } catch (error: any) {
            if (error.code === 9 || error.message?.includes('index')) {
                log('warn', 'Index required for last status query, falling back to simple query', { providerId });
                try {
                    const db = getDb();
                    const snapshot = await db.collection('status_history')
                        .where('id', '==', providerId)
                        .limit(10) // Get recent ones
                        .get();

                    if (snapshot.empty) return null;

                    // Sort in memory as fallback
                    const docs = snapshot.docs.sort((a, b) => {
                        const aTime = a.data().checkedAt?.toDate?.()?.getTime() || 0;
                        const bTime = b.data().checkedAt?.toDate?.()?.getTime() || 0;
                        return bTime - aTime;
                    });

                    const data = docs[0].data();
                    return {
                        id: data.id,
                        name: data.name,
                        status: data.status as ProviderStatus,
                        responseTime: data.responseTime,
                        lastChecked: data.checkedAt.toDate().toISOString(),
                        error: data.error,
                        statusPageUrl: data.statusPageUrl
                    };
                } catch (innerError) {
                    log('error', 'Fallback last status query failed', { innerError, providerId });
                }
            }
            log('error', 'Failed to get last status', { error, providerId });
            return null;
        }
    }

    async getHistory(options: { providerId?: string, limit?: number, startDate?: Date, endDate?: Date } = {}): Promise<StatusHistoryRecord[]> {
        try {
            const db = getDb();
            let query = db.collection('status_history').orderBy('checkedAt', 'desc');

            if (options.providerId) {
                query = query.where('id', '==', options.providerId);
            }

            if (options.startDate) {
                query = query.where('checkedAt', '>=', Timestamp.fromDate(options.startDate));
            }

            if (options.endDate) {
                query = query.where('checkedAt', '<=', Timestamp.fromDate(options.endDate));
            }

            if (options.limit) {
                query = query.limit(options.limit);
            }

            const snapshot = await query.get();

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: data.id,
                    name: data.name,
                    status: data.status as ProviderStatus,
                    responseTime: data.responseTime,
                    lastChecked: data.checkedAt.toDate().toISOString(),
                    checkedAt: data.checkedAt.toDate().toISOString(),
                    error: data.error,
                    statusPageUrl: data.statusPageUrl
                };
            });
        } catch (error: any) {
            if (error?.code === 9 || error?.message?.includes('index')) {
                log('warn', 'Index required for history query, falling back to simple query', { options });
                try {
                    const db = getDb();
                    let query: FirebaseFirestore.Query = db.collection('status_history');

                    if (options.providerId) {
                        query = query.where('id', '==', options.providerId);
                    }

                    const fetchLimit = Math.max(options.limit || 50, 200);
                    query = query.limit(fetchLimit);

                    const snapshot = await query.get();
                    let records = snapshot.docs.map((doc) => {
                        const data: any = doc.data();
                        const checkedAtDate =
                            typeof data.checkedAt?.toDate === 'function'
                                ? data.checkedAt.toDate()
                                : data.checkedAt instanceof Date
                                  ? data.checkedAt
                                  : data.lastChecked
                                    ? new Date(data.lastChecked)
                                    : new Date(0);

                        const checkedAtIso = checkedAtDate.toISOString();

                        return {
                            id: data.id,
                            name: data.name,
                            status: data.status as ProviderStatus,
                            responseTime: typeof data.responseTime === 'number' ? data.responseTime : 0,
                            lastChecked: checkedAtIso,
                            checkedAt: checkedAtIso,
                            error: data.error,
                            statusPageUrl: data.statusPageUrl
                        } satisfies StatusHistoryRecord;
                    });

                    // In-memory filtering/sorting to avoid composite index requirements
                    records.sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());

                    if (options.startDate) {
                        const start = options.startDate.getTime();
                        records = records.filter((r) => new Date(r.checkedAt).getTime() >= start);
                    }

                    if (options.endDate) {
                        const end = options.endDate.getTime();
                        records = records.filter((r) => new Date(r.checkedAt).getTime() <= end);
                    }

                    if (options.limit) {
                        records = records.slice(0, options.limit);
                    }

                    return records;
                } catch (innerError) {
                    log('error', 'Fallback history query failed', { innerError, options });
                }
            }

            log('error', 'Failed to get history', { error, options });
            return [];
        }
    }

    async getIncidents(options: { providerId?: string, limit?: number } = {}): Promise<StatusHistoryRecord[]> {
        try {
            const db = getDb();
            let query = db.collection('status_history')
                .where('status', '!=', 'operational')
                .orderBy('status') // Firestore requires this before other orderBys usually
                .orderBy('checkedAt', 'desc');

            if (options.providerId) {
                query = query.where('id', '==', options.providerId);
            }

            if (options.limit) {
                query = query.limit(options.limit);
            }

            const snapshot = await query.get();
            return this.mapDocs(snapshot.docs);
        } catch (error: any) {
            if (error.code === 9 || error.message?.includes('index')) {
                log('warn', 'Index required for incidents query, falling back to simple query');
                try {
                    const db = getDb();
                    // Fallback: No ordering, just where. User will see items, just not sorted perfectly.
                    const snapshot = await db.collection('status_history')
                        .where('status', '!=', 'operational')
                        .limit(1000)
                        .get();
                    return this.mapDocs(snapshot.docs);
                } catch (innerError) {
                    log('error', 'Fallback incidents query failed', { innerError });
                }
            }
            log('error', 'Failed to get incidents', { error, options });
            return [];
        }
    }

    async getSummary(options: { providerId?: string, days?: number } = {}): Promise<any> {
        // Basic summary implementation
        // For a real production app this should be pre-calculated
        const days = options.days || 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const history = await this.getHistory({
            providerId: options.providerId,
            startDate: startDate,
            limit: 1000 // Cap to avoid massive reads
        });

        const totalchecks = history.length;
        const downChecks = history.filter(h => h.status === 'down').length;
        const uptime = totalchecks > 0 ? ((totalchecks - downChecks) / totalchecks) * 100 : 100;

        return {
            period: `${days} days`,
            uptime: parseFloat(uptime.toFixed(2)),
            outages: downChecks,
            avgResponseTime: history.reduce((acc, h) => acc + h.responseTime, 0) / (totalchecks || 1)
        };
    }

    private mapDocs(docs: FirebaseFirestore.QueryDocumentSnapshot[]): StatusHistoryRecord[] {
        return docs.map(doc => {
            const data = doc.data();
            return {
                id: data.id,
                name: data.name,
                status: data.status as ProviderStatus,
                responseTime: data.responseTime,
                lastChecked: data.checkedAt.toDate().toISOString(),
                checkedAt: data.checkedAt.toDate().toISOString(),
                error: data.error,
                statusPageUrl: data.statusPageUrl
            };
        });
    }
}

export const persistenceService = new PersistenceService();
