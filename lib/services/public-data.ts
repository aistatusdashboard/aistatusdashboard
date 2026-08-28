import { getDb } from '@/lib/db/firestore';
import { providerService } from '@/lib/services/providers';
import { statusService } from '@/lib/services/status';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';
import type { NormalizedIncident } from '@/lib/types/ingestion';
import type { EvidenceItem } from '@/lib/utils/public-api';

export type ProviderCatalog = {
  id: string;
  name: string;
  display_name?: string;
  category?: string;
  status_url?: string;
  status_page_url?: string;
};

const DEFAULT_WINDOW_SECONDS = 1800;
const INACTIVE_INCIDENT_STATUSES = new Set(['resolved', 'completed', 'cancelled']);
const STALE_INCIDENT_MS = 24 * 60 * 60 * 1000;

function isIncidentActive(incident: {
  status?: string;
  severity?: string;
  resolvedAt?: string | null;
  updatedAt?: string;
}): boolean {
  if (INACTIVE_INCIDENT_STATUSES.has(normalizeIncidentStatus(incident.status, incident.severity, incident.resolvedAt))) {
    return false;
  }
  // A never-resolved incident with no update in 24h is a zombie; don't count it.
  const updated = Date.parse(incident.updatedAt || '');
  if (Number.isFinite(updated) && Date.now() - updated > STALE_INCIDENT_MS) return false;
  return true;
}

function normalizeIncidentStatus(
  status: string | undefined,
  severity: string | undefined,
  resolvedAt?: string | null
): string {
  const raw = String(status || '').toLowerCase();
  // A resolution timestamp settles it, whatever the status field says — some
  // feeds (e.g. Google Cloud) leave status as "unknown" on resolved incidents.
  if (resolvedAt && (!raw || raw === 'unknown')) return 'resolved';
  if (raw && raw !== 'unknown') return raw;
  // Active incidents should never surface as "unknown".
  if (severity === 'major_outage' || severity === 'degraded' || severity === 'partial_outage') {
    return 'investigating';
  }
  return 'identified';
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
  const [summaries, activeIncidents] = await Promise.all([
    intelligenceService.getProviderSummaries(),
    intelligenceService.getIncidents({
      providerId: options.providerId,
      limit: 300,
    }),
  ]);
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
  const activeIncidentCountTotalFromProviders = filtered.reduce(
    (acc, row) => acc + Number(row.active_incident_count || 0),
    0
  );
  const activeIncidentCountTotalFromFeed = activeIncidents.filter(isIncidentActive).length;
  const activeIncidentCountTotal = Math.max(
    activeIncidentCountTotalFromProviders,
    activeIncidentCountTotalFromFeed
  );
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
      all_systems_operational: activeIncidentCountTotal === 0,
      active_incidents_total: activeIncidentCountTotal,
      totals,
      providers: filtered,
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
  // Read only what the caller can actually use. Post-query filters (severity,
  // region, model, text) can discard rows, so fetch a small multiple of the
  // limit as headroom — never a flat 200, which turned a limit=1 request into
  // 200 document reads and dominated the Firestore bill.
  const incidents = await intelligenceService.getIncidents({
    providerId: options.providerId,
    startDate,
    limit: Math.min(200, Math.max(limit * 3, 10)),
  });

  const filtered = incidents.filter((incident) => {
    if (options.severity && incident.severity !== options.severity) return false;
    if (options.activeOnly && !isIncidentActive(incident)) {
      return false;
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

  const page = filtered.slice(startIndex, startIndex + limit).map((incident) => {
    const normalized = normalizeIncidentDates(incident);
    return {
    ...normalized,
    status: normalizeIncidentStatus(normalized.status, normalized.severity, normalized.resolvedAt),
    incident_id: `${incident.providerId}:${incident.id}`,
    permalink: `/incidents/${incident.providerId}:${incident.id}`,
  };
  });

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

  // The list endpoint is sourced from intelligenceService; consult it first so
  // detail lookups work even before persistence catches up.
  try {
    const memoryIncidents = await intelligenceService.getIncidents({
      providerId: providerId && innerIncidentId ? providerId : undefined,
      limit: 500,
    });
    const memoryMatch = memoryIncidents.find((row) => {
      if (`${row.providerId}:${row.id}` === incidentId) return true;
      return row.id === incidentId;
    });
    if (memoryMatch) {
      incident = memoryMatch as NormalizedIncident;
    }
  } catch {
    incident = null;
  }

  // Firestore document IDs cannot contain "/" path separators. For encoded route
  // params that decode to slash-containing IDs, skip direct doc lookup and query by fields.
  if (!incident && !incidentId.includes('/')) {
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
    status: normalizeIncidentStatus(normalized.status, normalized.severity, normalized.resolvedAt),
    incident_id: `${normalized.providerId}:${normalized.id}`,
    permalink: `/incidents/${normalized.providerId}:${normalized.id}`,
  };
}
