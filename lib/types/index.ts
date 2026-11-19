export type ProviderStatus =
    | 'operational'
    | 'degraded'
    | 'partial_outage'
    | 'down'
    | 'major_outage'
    | 'maintenance'
    | 'unknown';

export interface Provider {
    id: string;
    name: string;
    displayName?: string;
    category: string;
    statusUrl: string;
    statusPageUrl: string;
    // When this provider's alerts are labelled with one app ("ChatGPT (OpenAI)"),
    // the app whose scoped status decides them (see lib/services/app-scope.ts).
    alertApp?: string;
    format?: string;
    timeout?: number;
    enabled?: boolean;
    priority?: number;
    fallbackUrls?: string[];
    aliases?: string[];
    // For shared dashboards (Google's), only incidents mentioning these count.
    keywords?: string[];
    // For 'endpoint' sources: HTTP status codes that mean the service answered.
    expectStatus?: number[];
}

export interface StatusResult {
    id: string;
    name: string;
    displayName?: string;
    status: ProviderStatus;
    responseTime: number;
    lastChecked: string;
    error?: string;
    statusPageUrl?: string;
    details?: string;
    aliases?: string[];
}

export interface StatusHistoryRecord extends StatusResult {
    checkedAt: string;
}

export interface Comment {
    id: string;
    author: string;
    content: string;
    provider?: string | null;
    createdAt: string;
    approved: boolean;
    likes?: number;
    message?: string;
    type?: string;
    status?: string;
    replies?: Comment[];
}
