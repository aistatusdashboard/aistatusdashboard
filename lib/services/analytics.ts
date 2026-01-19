import { getDb } from '@/lib/db/firestore';
import { providerService } from '@/lib/services/providers';
import { commentService } from '@/lib/services/comments';
import { log } from '@/lib/utils/logger';
import type { ProviderAnalytics, CostMetrics, AnalyticsOverview } from '@/lib/types/analytics';

export interface AnalyticEvent {
    event: string;
    provider?: string;
    timestamp: string;
    metadata?: any;
}

export class AnalyticsService {
    private toDate(value: any): Date | null {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value?.toDate === 'function') return value.toDate();
        if (typeof value === 'string') {
            const parsed = new Date(value);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        return null;
    }

    private async loadEventsSince(since: Date): Promise<Array<{ id: string; data: any }>> {
        const db = getDb();
        const results = await Promise.allSettled([
            db.collection('analytics_events').where('timestamp', '>=', since).get(),
            db.collection('analytics_events').where('timestamp', '>=', since.toISOString()).get(),
        ]);

        const docs = new Map<string, any>();
        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                result.value.docs.forEach((doc) => {
                    docs.set(doc.id, doc.data());
                });
            }
        });

        return Array.from(docs.entries()).map(([id, data]) => ({ id, data }));
    }

    async track(event: string, providerId?: string, metadata: any = {}): Promise<void> {
        try {
            const db = getDb();
            await db.collection('analytics_events').add({
                type: event,
                providerId: providerId || null,
                sessionId: metadata?.sessionId || null,
                metadata,
                timestamp: new Date(),
            });
        } catch (e) {
            log('error', 'Analytics track failed', { error: e });
        }
    }

    async getEvents(options: any = {}): Promise<AnalyticEvent[]> {
        try {
            const db = getDb();
            let query = db.collection('analytics_events').orderBy('timestamp', 'desc').limit(options.limit || 100);

            if (options.providerId) {
                query = query.where('providerId', '==', options.providerId);
            }

            const snap = await query.get();
            return snap.docs.map(doc => {
                const d = doc.data();
                const timestamp =
                    typeof d.timestamp?.toDate === 'function'
                        ? d.timestamp.toDate()
                        : typeof d.timestamp === 'string'
                          ? new Date(d.timestamp)
                          : d.timestamp instanceof Date
                            ? d.timestamp
                            : new Date();
                return {
                    event: d.type,
                    provider: d.providerId,
                    timestamp: timestamp.toISOString(),
                    metadata: d.metadata
                };
            });
        } catch (e) {
            log('error', 'Failed to get events', { e });
            return [];
        }
    }

    async getTopProviders(options: { limit?: number; windowDays?: number } = {}): Promise<ProviderAnalytics[]> {
        try {
            const windowDays = typeof options.windowDays === 'number' ? options.windowDays : 7;
            const limit = typeof options.limit === 'number' ? options.limit : 10;
            const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
            const docs = await this.loadEventsSince(since);

            const providers = providerService.getProviders();
            const byId = new Map(providers.map((p) => [p.id, p.displayName || p.name] as const));

            // Always return a stable set of providers (even when analytics is empty/unavailable)
            const stats: Record<string, ProviderAnalytics> = {};

            const ensureProvider = (providerId: string) => {
                const normalizedId = providerId || 'unknown';
                if (!stats[normalizedId]) {
                    stats[normalizedId] = {
                        providerId: normalizedId,
                        providerName: byId.get(normalizedId) || normalizedId,
                        totalInteractions: 0,
                        interactionsByType: { clicks: 0, subscriptions: 0 },
                        tier: 'low',
                        popularityScore: 0,
                    };
                }
                return stats[normalizedId];
            };

            // Seed providers so UI always has rows
            providers.forEach((p) => ensureProvider(p.id));

            docs.forEach(({ data }) => {
                const d = data;
                const pId = typeof d?.providerId === 'string' && d.providerId.length > 0 ? d.providerId : null;
                if (!pId) return;
                const entry = ensureProvider(pId);

                const eventType = typeof d?.type === 'string' ? d.type : 'interaction';
                const isSubscription =
                    eventType === 'subscription' || eventType === 'email_subscribe' || eventType === 'subscribe';
                const isClick =
                    eventType === 'interaction' ||
                    eventType === 'provider_click' ||
                    eventType === 'provider_status_click' ||
                    eventType === 'provider_view' ||
                    eventType === 'click';

                if (!isSubscription && !isClick) {
                    return;
                }

                entry.totalInteractions++;

                if (isSubscription) {
                    entry.interactionsByType.subscriptions++;
                }
                if (isClick) {
                    entry.interactionsByType.clicks++;
                }
            });

            const results = Object.values(stats).map((p) => {
                p.popularityScore = Math.round(
                    p.totalInteractions + p.interactionsByType.subscriptions * 2 + p.interactionsByType.clicks
                );
                return p;
            });

            // Tiering based on rank
            results.sort((a, b) => b.totalInteractions - a.totalInteractions);
            results.forEach((p, idx) => {
                if (idx < 3 && p.totalInteractions > 0) p.tier = 'high';
                else if (idx < 8 && p.totalInteractions > 0) p.tier = 'medium';
                else p.tier = 'low';
            });

            return results.slice(0, limit);
        } catch (e) {
            log('error', 'Failed to aggregate providers', { e });
            // Graceful fallback: return providers list so UI doesn't appear broken
            const limit = typeof options.limit === 'number' ? options.limit : 10;
            return providerService.getProviders().slice(0, limit).map((p) => ({
                providerId: p.id,
                providerName: p.displayName || p.name,
                totalInteractions: 0,
                interactionsByType: { clicks: 0, subscriptions: 0 },
                tier: 'low',
                popularityScore: 0,
            }));
        }
    }

    async getOverview(windowDays = 7): Promise<AnalyticsOverview> {
        const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
        try {
            getDb();
        } catch (error) {
            log('error', 'Failed to initialize Firestore for analytics overview', { error });
            return {
                windowDays,
                totalEvents: 0,
                uniqueSessions: 0,
                eventCounts: {
                    pageViews: 0,
                    providerClicks: 0,
                    subscriptions: 0,
                    comments: 0,
                    commentsSubmitted: 0,
                    commentsApproved: 0,
                    exports: 0,
                },
                lastEventAt: null,
            };
        }

        let events: Array<{ id: string; data: any }> = [];
        try {
            events = await this.loadEventsSince(since);
        } catch (error) {
            log('error', 'Failed to load analytics events', { error });
        }

        const eventCounts = {
            pageViews: 0,
            providerClicks: 0,
            subscriptions: 0,
            comments: 0,
            commentsSubmitted: 0,
            commentsApproved: 0,
            exports: 0,
        };
        const sessions = new Set<string>();
        let lastEventAt: Date | null = null;
        let totalEvents = 0;

        if (events.length > 0) {
            events.forEach(({ data }) => {
                const d = data as any;
                const timestamp = this.toDate(d?.timestamp);
                const sessionId =
                    typeof d?.sessionId === 'string'
                        ? d.sessionId
                        : typeof d?.metadata?.sessionId === 'string'
                          ? d.metadata.sessionId
                          : null;

                const type = typeof d?.type === 'string' ? d.type : '';
                let counted = false;
                if (type === 'page_view' || type === 'tab_view') {
                    eventCounts.pageViews++;
                    counted = true;
                }
                if (
                    type === 'interaction' ||
                    type === 'provider_click' ||
                    type === 'provider_status_click' ||
                    type === 'provider_view' ||
                    type === 'click'
                ) {
                    eventCounts.providerClicks++;
                    counted = true;
                }
                if (type === 'subscription' || type === 'email_subscribe' || type === 'subscribe') {
                    eventCounts.subscriptions++;
                    counted = true;
                }
                if (type === 'comment_post') {
                    eventCounts.comments++;
                    eventCounts.commentsSubmitted++;
                    counted = true;
                }
                if (type === 'export' || type === 'share' || type === 'copy_api_url') {
                    eventCounts.exports++;
                    counted = true;
                }

                if (counted) {
                    totalEvents++;
                    if (sessionId) sessions.add(sessionId);
                    if (timestamp && (!lastEventAt || timestamp > lastEventAt)) {
                        lastEventAt = timestamp;
                    }
                }
            });
        }

        let commentsApproved = 0;
        try {
            commentsApproved = await commentService.countApprovedSince(since);
        } catch (error) {
            log('error', 'Failed to load approved comments count', { error });
        }
        eventCounts.commentsApproved = commentsApproved;

        return {
            windowDays,
            totalEvents,
            uniqueSessions: sessions.size,
            eventCounts,
            lastEventAt: lastEventAt ? (lastEventAt as Date).toISOString() : null,
        };
    }

    async getCostMetrics(): Promise<CostMetrics> {
        return {
            currentMonth: {
                estimatedCost: 125.50,
                firestoreWrites: 50000
            },
            projectedMonthlyCost: 150.00,
            costTrends: { dailyAverage: 5.00 },
            topCostProviders: [],
            recommendations: ['Enable caching to reduce reads']
        };
    }

    async getRecommendations() {
        return {
            addProviders: [],
            removeProviders: [],
            optimizations: ['Increase cache TTL'],
            reasoning: {}
        };
    }
}

export const analyticsService = new AnalyticsService();
