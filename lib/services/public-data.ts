import { getDb } from '@/lib/db/firestore';
import { providerService } from '@/lib/services/providers';
import { statusService } from '@/lib/services/status';
import { intelligenceService } from '@/lib/services/intelligence';
import { insightsService } from '@/lib/services/insights';
import { persistenceService } from '@/lib/services/persistence';
import modelsCatalog from '@/lib/data/models.json';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';
import type { NormalizedIncident } from '@/lib/types/ingestion';
import type { ModelMatrixTile } from '@/lib/types/insights';
import type { EvidenceItem } from '@/lib/utils/public-api';
import { queryMetricSeries, type MetricName } from '@/lib/services/metrics';

export type CatalogModel = {
  id: string;
  tier: string;
  streaming: boolean;
};

export type ProviderCatalog = {
  id: string;
  name: string;
  display_name?: string;
  category?: string;
  status_url?: string;
  status_page_url?: string;
};

const DEFAULT_WINDOW_SECONDS = 1800;
type HealthSignal = ModelMatrixTile['signal'];

function resolveCatalog(providerId: string) {
  const catalog = (modelsCatalog as Record<string, any>)[providerId] || (modelsCatalog as any)._default;
  return catalog;
}

export function listProviders(): ProviderCatalog[] {
  return providerService.getProviders().map((provider) => ({
    id: provider.id,
    name: provider.name,
    display_name: provider.displayName || undefined,
    category: provider.category,
    status_url: provider.statusUrl,
    status_page_url: provider.statusPageUrl,
  }));
}

export function listProviderSurfaces(providerId: string): string[] {
  const catalog = resolveCatalog(providerId);
  const surfaces = new Set<string>(['status']);
  (catalog.endpoints || []).forEach((endpoint: string) => surfaces.add(endpoint));
  return Array.from(surfaces);
}

export function listProviderRegions(providerId: string): string[] {
  const catalog = resolveCatalog(providerId);
  return (catalog.regions || ['global']).slice();
}

export function listProviderModels(providerId: string): CatalogModel[] {
  const catalog = resolveCatalog(providerId);
  return (catalog.models || []).map((model: any) => ({
    id: model.id,
    tier: model.tier || 'unknown',
    streaming: Boolean(model.streaming),
  }));
}

export async function getStatusSummary(options: {
  providerId?: string;
  windowSeconds?: number;
  lens?: string;
}) {
  const windowSeconds = options.windowSeconds || DEFAULT_WINDOW_SECONDS;
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const until = new Date().toISOString();

  const providers = listProviders().filter((provider) =>
    options.providerId ? provider.id === options.providerId : true
  );
  const summaries = await intelligenceService.getProviderSummaries();
  const summaryMap = new Map(summaries.map((summary) => [summary.providerId, summary]));

  const statusRows = await Promise.all(
    providers.map(async (provider) => {
      const summary = summaryMap.get(provider.id);
      if (summary) {
        return {
          provider_id: provider.id,
          name: provider.name,
          display_name: provider.display_name,
          status: summary.status,
          description: summary.description || undefined,
          last_updated: summary.lastUpdated || undefined,
          active_incident_count: summary.activeIncidentCount || 0,
          active_maintenance_count: summary.activeMaintenanceCount || 0,
          degraded_component_count: summary.degradedComponentCount || 0,
          source: 'official',
        };
      }

      const providerRecord = providerService.getProvider(provider.id);
      if (!providerRecord) return null;
      const fallbackStatus = await statusService.checkProvider(providerRecord);
      return {
        provider_id: provider.id,
        name: provider.name,
        display_name: provider.display_name,
        status: fallbackStatus.status,
        description: fallbackStatus.details,
        last_updated: fallbackStatus.lastChecked,
        active_incident_count: 0,
        active_maintenance_count: 0,
        degraded_component_count: 0,
        source: 'fallback',
      };
    })
  );

  const filtered = statusRows.filter(Boolean) as Array<Record<string, any>>;
  const totals = filtered.reduce(
    (acc, row) => {
      acc.total += 1;
      switch (row.status) {
        case 'operational':
          acc.operational += 1;
          break;
        case 'degraded':
        case 'partial_outage':
          acc.degraded += 1;
          break;
        case 'major_outage':
        case 'down':
          acc.down += 1;
          break;
        case 'maintenance':
          acc.maintenance += 1;
          break;
        default:
          acc.unknown += 1;
      }
      return acc;
    },
    { total: 0, operational: 0, degraded: 0, down: 0, maintenance: 0, unknown: 0 }
  );

  const evidence: EvidenceItem[] = providers.map((provider) => ({
    source_url: provider.status_page_url || provider.status_url,
    metric_window: { since, until },
    ids: [provider.id],
  }));

  const freshness = filtered.filter((row) => {
    if (!row.last_updated) return false;
    const updatedAt = Date.parse(row.last_updated);
    return Number.isFinite(updatedAt) && Date.now() - updatedAt <= windowSeconds * 1000;
  }).length;
  const confidence = filtered.length
    ? Math.min(1, 0.4 + (freshness / filtered.length) * 0.6)
    : 0.3;

  return {
    data: {
      window_seconds: windowSeconds,
      lens: options.lens || 'official',
      totals,
      providers: filtered,
    },
    evidence,
    confidence,
  };
}

export async function getHealthMatrix(options: {
  providerId: string;
  windowSeconds?: number;
  lens?: string;
}) {
  const windowSeconds = options.windowSeconds || DEFAULT_WINDOW_SECONDS;
  const windowMinutes = Math.max(1, Math.round(windowSeconds / 60));
  const matrix = await insightsService.getModelMatrix({
    providerId: options.providerId,
    windowMinutes,
  });
  const provider = providerService.getProvider(options.providerId);
  const sourceUrl = provider?.statusPageUrl || provider?.statusUrl;

  const evidence: EvidenceItem[] = matrix.tiles.slice(0, 6).map((tile) => ({
    source_url: sourceUrl,
    note: tile.evidence?.snapshot,
    metric_window: {
      since: new Date(Date.now() - windowSeconds * 1000).toISOString(),
      until: new Date().toISOString(),
    },
    ids: [
      `${tile.providerId}:${tile.model}:${tile.region}:${tile.endpoint}`,
    ],
  }));

  const confidence = matrix.tiles.length
    ? Math.min(
        1,
        matrix.tiles.reduce((acc, tile) => {
          if (tile.confidence === 'high') return acc + 1;
          if (tile.confidence === 'medium') return acc + 0.6;
          if (tile.confidence === 'low') return acc + 0.3;
          return acc + 0.2;
        }, 0) / matrix.tiles.length
      )
    : 0.3;

  return {
    data: {
      provider_id: matrix.providerId,
      window_seconds: windowSeconds,
      lens: options.lens || 'observed',
      tiles: matrix.tiles,
    },
    evidence,
    confidence,
  };
}

export async function searchIncidents(options: {
  providerId?: string;
  severity?: string;
  activeOnly?: boolean;
  since?: string;
  until?: string;
  region?: string;
  model?: string;
  query?: string;
  cursor?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(options.limit || 50, 1), 200);
  const startDate = options.since || undefined;
  const incidents = await intelligenceService.getIncidents({
    providerId: options.providerId,
    startDate,
    limit: Math.max(200, limit * 3),
  });

  const filtered = incidents.filter((incident) => {
    if (options.severity && incident.severity !== options.severity) return false;
    if (options.activeOnly) {
      const inactive = ['resolved', 'completed', 'cancelled'];
      if (inactive.includes(incident.status)) return false;
    }
    if (options.region) {
      const regions = incident.impactedRegions || [];
      if (!regions.includes(options.region)) return false;
    }
    if (options.model) {
      const models = incident.impactedModels || [];
      if (!models.includes(options.model)) return false;
    }
    if (options.until) {
      const untilDate = new Date(options.until);
      if (Number.isFinite(untilDate.getTime())) {
        const updatedAt = new Date(incident.updatedAt).getTime();
        if (updatedAt > untilDate.getTime()) return false;
      }
    }
    if (options.query) {
      const q = options.query.toLowerCase();
      const haystack = [incident.title, incident.sourceStatus, incident.sourceSeverity]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const updateMatch = incident.updates?.some((update) =>
        update.body?.toLowerCase().includes(q)
      );
      if (!haystack.includes(q) && !updateMatch) return false;
    }
    return true;
  });

  filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  let startIndex = 0;
  if (options.cursor) {
    const idx = filtered.findIndex((incident) =>
      `${incident.providerId}:${incident.id}` === options.cursor
    );
    if (idx >= 0) startIndex = idx + 1;
  }

  const page = filtered.slice(startIndex, startIndex + limit).map((incident) => ({
    ...normalizeIncidentDates(incident),
    incident_id: `${incident.providerId}:${incident.id}`,
    permalink: `/incidents/${incident.providerId}:${incident.id}`,
  }));

  const nextCursor = startIndex + limit < filtered.length
    ? `${filtered[startIndex + limit - 1].providerId}:${filtered[startIndex + limit - 1].id}`
    : null;

  return {
    data: {
      incidents: page,
      next_cursor: nextCursor,
    },
    evidence: page.slice(0, 5).map((incident) => ({
      source_url: incident.rawUrl,
      ids: [incident.incident_id],
      metric_window: {
        since: incident.startedAt,
        until: incident.updatedAt,
      },
    })),
    confidence: page.length ? 0.75 : 0.4,
  };
}

export async function getIncidentById(incidentId: string) {
  const db = getDb();
  let incident: NormalizedIncident | null = null;
  const [providerId, ...rest] = incidentId.split(':');
  const innerIncidentId = rest.join(':');

  // Firestore document IDs cannot contain "/" path separators. For encoded route
  // params that decode to slash-containing IDs, skip direct doc lookup and query by fields.
  if (!incidentId.includes('/')) {
    const doc = await db.collection('incidents').doc(incidentId).get();
    if (doc.exists) {
      incident = doc.data() as NormalizedIncident;
    }
  }

  if (!incident && providerId && innerIncidentId) {
    try {
      const querySnap = await db
        .collection('incidents')
        .where('providerId', '==', providerId)
        .where('id', '==', innerIncidentId)
        .limit(1)
        .get();
      if (!querySnap.empty) {
        incident = querySnap.docs[0].data() as NormalizedIncident;
      }
    } catch {
      incident = null;
    }
  }

  if (!incident) {
    const querySnap = await db
      .collection('incidents')
      .where('id', '==', incidentId)
      .limit(1)
      .get();
    if (!querySnap.empty) {
      incident = querySnap.docs[0].data() as NormalizedIncident;
    }
  }

  if (!incident) return null;

  const normalized = normalizeIncidentDates(incident);
  return {
    ...normalized,
    incident_id: `${normalized.providerId}:${normalized.id}`,
    permalink: `/incidents/${normalized.providerId}:${normalized.id}`,
  };
}

export async function queryMetrics(options: {
  metric: MetricName;
  providerId?: string;
  surface?: string;
  model?: string;
  region?: string;
  tier?: string;
  streaming?: boolean;
  since?: string;
  until?: string;
  granularitySeconds?: number;
}) {
  const since = options.since ? new Date(options.since) : new Date(Date.now() - DEFAULT_WINDOW_SECONDS * 1000);
  const until = options.until ? new Date(options.until) : new Date();
  const granularitySeconds = Math.max(options.granularitySeconds || 300, 60);

  const series = await queryMetricSeries({
    metric: options.metric,
    providerId: options.providerId,
    surface: options.surface,
    model: options.model,
    region: options.region,
    tier: options.tier,
    streaming: options.streaming,
    since,
    until,
    granularitySeconds,
  });

  const evidence: EvidenceItem[] = [
    {
      source_url: 'https://aistatusdashboard.com/api/public/v1/metrics',
      metric_window: { since: since.toISOString(), until: until.toISOString() },
      ids: [options.providerId || 'all'],
      note: `granularity:${granularitySeconds}s`,
    },
  ];

  const sampleCount = series.series.reduce((acc, point) => acc + point.sample_count, 0);
  const confidence = sampleCount > 30 ? 0.85 : sampleCount > 10 ? 0.7 : sampleCount > 0 ? 0.55 : 0.3;

  return {
    data: series,
    evidence,
    confidence,
  };
}

export async function buildFallbackPlan(options: {
  providerId?: string;
  model: string;
  endpoint: string;
  region: string;
  tier?: string;
  streaming?: boolean;
  signal?: string;
  latencyP50?: number;
  latencyP95?: number;
  latencyP99?: number;
  http5xxRate?: number;
  http429Rate?: number;
  tokensPerSec?: number;
  streamDisconnectRate?: number;
}) {
  const normalizedSignal: HealthSignal = (() => {
    if (!options.signal) return 'no-data';
    switch (options.signal.toLowerCase()) {
      case 'healthy':
        return 'healthy';
      case 'degraded':
        return 'degraded';
      case 'down':
        return 'down';
      case 'no-data':
        return 'no-data';
      default:
        return 'no-data';
    }
  })();

  const plan = insightsService.buildFallbackPlan({
    providerId: options.providerId,
    model: options.model,
    endpoint: options.endpoint,
    region: options.region,
    tier: options.tier || 'unknown',
    streaming: Boolean(options.streaming),
    signal: normalizedSignal,
    latencyP50: options.latencyP50,
    latencyP95: options.latencyP95,
    latencyP99: options.latencyP99,
    http5xxRate: options.http5xxRate,
    http429Rate: options.http429Rate,
    tokensPerSec: options.tokensPerSec,
    streamDisconnectRate: options.streamDisconnectRate,
  });

  const windowMs = plan.evidence?.windowMinutes ? plan.evidence.windowMinutes * 60 * 1000 : undefined;
  return {
    data: plan,
    evidence: plan.evidence
      ? [
          {
            source_url: 'https://aistatusdashboard.com/api/public/v1/recommendations/fallback_plan',
            ids: [
              `${options.providerId || 'global'}:${options.model}:${options.region}:${options.endpoint}`,
            ],
            metric_window: windowMs
              ? { since: new Date(Date.now() - windowMs).toISOString(), until: new Date().toISOString() }
              : undefined,
            note: plan.evidence.snapshot,
          },
        ]
      : [],
    confidence: normalizedSignal !== 'no-data' ? 0.75 : 0.6,
  };
}

export async function generatePolicy(options: {
  providerId?: string;
  model: string;
  endpoint: string;
  region: string;
  tier?: string;
  streaming?: boolean;
  objective?: string;
}) {
  const plan = await buildFallbackPlan({
    providerId: options.providerId,
    model: options.model,
    endpoint: options.endpoint,
    region: options.region,
    tier: options.tier,
    streaming: options.streaming,
  });

  const policy = {
    policy_id: `policy-${options.providerId || 'global'}-${options.model}-${options.region}`,
    summary: `Routing policy for ${options.model} in ${options.region}.`,
    objective: options.objective || 'Maintain low-latency, high-availability routing.',
    rules: [
      {
        match: {
          provider_id: options.providerId || 'any',
          model: options.model,
          region: options.region,
          endpoint: options.endpoint,
        },
        actions: plan.data.actions,
        thresholds: plan.data.jsonPolicy?.thresholds,
        cooldown_minutes: plan.data.jsonPolicy?.cooldownMinutes,
      },
    ],
  };

  return {
    data: policy,
    evidence: plan.evidence,
    confidence: plan.confidence,
  };
}

export async function getStatusHistorySummary(options: { providerId?: string; days?: number }) {
  const summary = await persistenceService.getSummary({
    providerId: options.providerId,
    days: options.days || 7,
  });

  return {
    data: summary,
    evidence: [
      {
        note: `history window: ${summary.period}`,
        ids: options.providerId ? [options.providerId] : undefined,
      },
    ],
    confidence: summary.totalchecks > 0 ? 0.75 : 0.4,
  };
}
