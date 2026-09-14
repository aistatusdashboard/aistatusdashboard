import type { NormalizedComponent, NormalizedIncident, NormalizedIncidentStatus, NormalizedSeverity } from '@/lib/types/ingestion';

// Flashcat status pages (status.deepseek.com moved here from Statuspage in
// May 2026, which silently 404'd our feed for four months).
//
//   GET {base}/api/status-page/{pageId}/summary/active
//     → { data: { page: { components: [...] }, active_changes: [...] } }
//   GET {base}/api/status-page/{pageId}/change/list?start_at_seconds&end_at_seconds
//     → { data: { items: [ { change_id, type, title, status, start_at_seconds,
//                              close_at_seconds, affected_components:[{status}], updates:[...] } ] } }

function toIso(seconds: unknown): string | undefined {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : undefined;
}

// Flashcat component statuses follow the Statuspage vocabulary.
function severityFrom(raw: unknown): NormalizedSeverity {
  const s = String(raw || '').toLowerCase();
  if (!s || s === 'operational' || s === 'available') return 'operational';
  if (s.includes('major')) return 'major_outage';
  if (s.includes('partial')) return 'partial_outage';
  if (s.includes('maint')) return 'maintenance';
  if (s.includes('degrad') || s.includes('minor')) return 'degraded';
  return 'degraded';
}

function worst(severities: NormalizedSeverity[]): NormalizedSeverity {
  const rank: Record<NormalizedSeverity, number> = { operational: 0, unknown: 0, maintenance: 1, degraded: 2, partial_outage: 3, major_outage: 4 };
  return severities.reduce<NormalizedSeverity>((acc, s) => (rank[s] > rank[acc] ? s : acc), 'operational');
}

function incidentStatusFrom(raw: unknown, closed: boolean): NormalizedIncidentStatus {
  const s = String(raw || '').toLowerCase();
  if (closed || s === 'resolved' || s === 'completed') return 'resolved';
  if (s === 'identified') return 'identified';
  if (s === 'monitoring') return 'monitoring';
  return 'investigating';
}

export function parseFlashcatChange(providerId: string, sourceId: string, item: any): NormalizedIncident | null {
  if (!item || item.type !== 'incident') return null;
  const startedAt = toIso(item.start_at_seconds);
  if (!startedAt) return null;
  const updates: any[] = Array.isArray(item.updates) ? item.updates : [];
  const latestUpdateAt = updates
    .map((u) => Number(u?.at_seconds))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0];
  const resolvedAt = toIso(item.close_at_seconds);
  const affected: any[] = Array.isArray(item.affected_components) ? item.affected_components : [];
  const severity = worst(affected.map((c) => severityFrom(c?.status)));
  // Strip the Chinese half of bilingual titles when an English one is present.
  const title = String(item.title || 'Incident').replace(/^[^(]*[（(]([^)）]*[A-Za-z][^)）]*)[)）]\s*$/, '$1').trim() || String(item.title);
  return {
    id: String(item.change_id),
    providerId,
    sourceId,
    title,
    status: incidentStatusFrom(item.status, Boolean(resolvedAt)),
    severity: severity === 'operational' ? 'degraded' : severity,
    startedAt,
    updatedAt: toIso(latestUpdateAt) || resolvedAt || startedAt,
    resolvedAt,
    impactedComponents: affected.map((c) => String(c?.component_id || '')).filter(Boolean),
    impactedComponentNames: affected.map((c) => String(c?.name || '')).filter(Boolean),
    sourceStatus: typeof item.status === 'string' ? item.status : undefined,
    updates: [],
  };
}

export function parseFlashcatActive(
  providerId: string,
  summary: any
): { components: NormalizedComponent[]; status: NormalizedSeverity } {
  const data = summary?.data || {};
  const rawComponents: any[] = Array.isArray(data?.page?.components) ? data.page.components : [];
  const active: any[] = Array.isArray(data?.active_changes) ? data.active_changes : [];

  // Current per-component state only appears inside active changes; a
  // component not named by any active change is healthy.
  const impacted = new Map<string, NormalizedSeverity>();
  for (const change of active) {
    if (change?.type !== 'incident') continue;
    for (const c of Array.isArray(change.affected_components) ? change.affected_components : []) {
      const id = String(c?.component_id || '');
      if (!id) continue;
      const sev = severityFrom(c?.status);
      impacted.set(id, worst([impacted.get(id) || 'operational', sev === 'operational' ? 'degraded' : sev]));
    }
  }

  const components: NormalizedComponent[] = rawComponents.map((c) => ({
    id: String(c.component_id),
    providerId,
    name: String(c.name || c.component_id),
    status: impacted.get(String(c.component_id)) || 'operational',
    description: typeof c.description === 'string' ? c.description : undefined,
  }));

  return { components, status: worst(components.map((c) => c.status)) };
}
