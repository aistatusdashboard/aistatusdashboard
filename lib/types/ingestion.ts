export type NormalizedSeverity =
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance'
  | 'unknown';

export type NormalizedIncidentStatus =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'unknown';

export type PlatformType =
  | 'statuspage'
  | 'instatus'
  | 'flashcat'
  | 'betterstack'
  | 'statusio'
  | 'cachet'
  | 'google-cloud'
  | 'aws'
  | 'azure'
  | 'rss'
  | 'meta'
  | 'html'
  | 'unknown';

export interface SourceDefinition {
  id: string;
  providerId: string;
  name: string;
  baseUrl: string;
  statusUrl?: string;
  platform?: PlatformType | 'auto';
  pollIntervalSeconds: number;
  metadata?: Record<string, string>;
}

export interface NormalizedComponent {
  id: string;
  providerId: string;
  name: string;
  status: NormalizedSeverity;
  description?: string;
  groupId?: string;
  groupName?: string;
  updatedAt?: string;
}

export interface NormalizedIncidentUpdate {
  id: string;
  status: NormalizedIncidentStatus;
  body: string;
  createdAt: string;
}

export interface NormalizedIncident {
  id: string;
  providerId: string;
  sourceId: string;
  title: string;
  status: NormalizedIncidentStatus;
  severity: NormalizedSeverity;
  startedAt: string;
  updatedAt: string;
  resolvedAt?: string;
  impactedComponents?: string[];
  impactedComponentNames?: string[];
  impactedRegions?: string[];
  impactedModels?: string[];
  sourceSeverity?: string;
  sourceStatus?: string;
  serviceId?: string;
  serviceName?: string;
  updates: NormalizedIncidentUpdate[];
  rawUrl?: string;
}

export interface NormalizedMaintenance {
  id: string;
  providerId: string;
  sourceId: string;
  title: string;
  status: NormalizedIncidentStatus;
  severity: NormalizedSeverity;
  scheduledFor: string;
  updatedAt: string;
  completedAt?: string;
  affectedComponents?: string[];
  updates: NormalizedIncidentUpdate[];
}

export interface NormalizedProviderSummary {
  providerId: string;
  sourceId: string;
  status: NormalizedSeverity;
  description?: string;
  lastUpdated: string;
  components: NormalizedComponent[];
  incidents: NormalizedIncident[];
  maintenances: NormalizedMaintenance[];
}

export interface SourceFetchResult {
  ok: boolean;
  statusCode: number;
  etag?: string | null;
  lastModified?: string | null;
  body?: string;
  json?: any;
  error?: string;
}

export interface SourceRegistryEntry {
  sourceId: string;
  providerId: string;
  platform: PlatformType;
  etag?: string | null;
  lastModified?: string | null;
  lastFetchedAt?: string;
  lastStatusCode?: number;
  nextFetchAt?: string;
}
