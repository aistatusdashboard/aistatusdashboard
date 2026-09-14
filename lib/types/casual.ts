export type ExperienceSurfaceId =
  | 'text'
  | 'images'
  | 'voice'
  | 'browse'
  | 'tools'
  | 'login'
  | 'billing'
  | 'rate_limits';

export type ExperienceSignal = 'operational' | 'degraded' | 'down' | 'unknown';

export type ExperienceEvidence = {
  label: string;
  url: string;
  type: 'official' | 'observed' | 'incident' | 'metrics' | 'report';
};

// An incident the provider still lists as open but has not updated for a
// day or more. It no longer drives the verdict (our own tests do), but a
// visitor deserves to know the official page disagrees with "all clear".
export type OfficialNotice = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  url: string;
};

export type ExperienceSurfaceStatus = {
  id: ExperienceSurfaceId;
  label: string;
  status: ExperienceSignal;
  headline: string;
  symptoms: string[];
  actions: string[];
  confidence: number;
  updated_at: string;
  evidence: ExperienceEvidence[];
  sources: string[];
  metrics?: {
    latency_p95_ms?: number;
    http_429_rate?: number;
    http_5xx_rate?: number;
    stream_disconnect_rate?: number;
    sample_count?: number;
  };
};

export type ExperienceReportSummary = {
  window_minutes: number;
  reports: number;
  likely_global: boolean;
  baseline_per_10m: number;
  top_regions: Array<{ region: string; count: number }>;
  note: string;
};

export type ExperienceHistorySummary = {
  typical_resolution_minutes?: number;
  last_similar_event?: {
    title: string;
    ended_at: string;
    duration_minutes: number;
    url: string;
  };
};

export type ExperienceStatus = {
  app_id: string;
  app_name: string;
  provider_id: string;
  overall_status: ExperienceSignal;
  headline: string;
  symptoms: string[];
  actions: string[];
  confidence: number;
  updated_at: string;
  surfaces: ExperienceSurfaceStatus[];
  is_it_just_me: ExperienceReportSummary;
  history: ExperienceHistorySummary;
  evidence: ExperienceEvidence[];
  official_notices: OfficialNotice[];
};

export type CasualAppConfig = {
  id: string;
  label: string;
  providerId: string;
  providerDisplay: string;
  surfaces: ExperienceSurfaceId[];
  defaultModel?: string;
  defaultRegion?: string;
};
