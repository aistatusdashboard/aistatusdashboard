export interface ProviderAnalytics {
    providerId: string;
    providerName: string;
    tier: 'high' | 'medium' | 'low';
    popularityScore: number;
    totalInteractions: number;
    interactionsByType: {
        clicks: number;
        subscriptions: number;
    };
}

export interface AnalyticsOverview {
    windowDays: number;
    totalEvents: number;
    uniqueSessions: number;
    eventCounts: {
        pageViews: number;
        providerClicks: number;
        subscriptions: number;
        comments: number;
        commentsSubmitted?: number;
        commentsApproved?: number;
        exports: number;
    };
    lastEventAt: string | null;
}

export interface CostMetrics {
    currentMonth: {
        estimatedCost: number;
        firestoreWrites: number;
    };
    projectedMonthlyCost: number;
    costTrends: {
        dailyAverage: number;
    };
    topCostProviders: Array<{
        providerId: string;
        cost: number;
        operations: number;
        costEfficiency: number;
    }>;
    recommendations: string[];
}
