import type { NormalizedComponent, NormalizedIncident, NormalizedIncidentStatus, NormalizedSeverity } from '@/lib/types/ingestion';

// incident.io status pages (status.perplexity.com since 2026-09-10). The page
// front end reads two JSON routes on the page's own domain:
//   GET {base}/proxy/{host}            → { summary: { components, affected_components, ongoing_incidents, … } }
//   GET {base}/proxy/{host}/incidents  → { incidents: [ { id, name, type, status, published_at,
//                                           affected_components:[{component_id,status,current_status}],
//                                           component_impacts:[{start_at,end_at,status}],
//                                           updates:[{published_at,message_string,to_status}] } ] }

function severityFrom(raw: unknown): NormalizedSeverity {
  const s = String(raw || '').toLowerCase();
  if (!s || s === 'operational') return 'operational';
  if (s.includes('full') || s.includes('major')) return 'major_outage';
  if (s.includes('partial')) return 'partial_outage';
  if (s.includes('maint')) return 'maintenance';
  if (s.includes('degrad')) return 'degraded';
  return 'degraded';
}

function worst(severities: NormalizedSeverity[]): NormalizedSeverity {
  const rank: Record<NormalizedSeverity, number> = { operational: 0, unknown: 0, maintenance: 1, degraded: 2, partial_outage: 3, major_outage: 4 };
  return severities.reduce<NormalizedSeverity>((acc, s) => (rank[s] > rank[acc] ? s : acc), 'operational');
}

function incidentStatusFrom(raw: unknown): NormalizedIncidentStatus {
  const s = String(raw || '').toLowerCase();
  if (s === 'resolved' || s.endsWith('_complete') || s === 'complete') return 'resolved';
  if (s === 'identified') return 'identified';
  if (s === 'monitoring') return 'monitoring';
  return 'investigating';
}

export function parseIncidentIoSummary(
  providerId: string,
  payload: any
): { components: NormalizedComponent[]; status: NormalizedSeverity; ongoing: number } {
  const summary = payload?.summary || {};
  const affected = new Map<string, NormalizedSeverity>();
  for (const item of Array.isArray(summary.affected_components) ? summary.affected_components : []) {
    if (item?.component_id) affected.set(String(item.component_id), severityFrom(item.status));
  }
  const now = new Date().toISOString();
  const components: NormalizedComponent[] = (Array.isArray(summary.components) ? summary.components : [])
    .filter((c: any) => c?.id && c?.name)
    .map((c: any) => ({
      id: String(c.id),
      providerId,
      name: String(c.name),
      status: affected.get(String(c.id)) || 'operational',
      updatedAt: now,
    }));
  const ongoing = Array.isArray(summary.ongoing_incidents) ? summary.ongoing_incidents.length : 0;
  const status = worst([...components.map((c) => c.status), ...(ongoing ? (['degraded'] as NormalizedSeverity[]) : [])]);
  return { components, status, ongoing };
}

export function parseIncidentIoIncident(
  providerId: string,
  sourceId: string,
  names: Map<string, string>,
  item: any,
  pageUrl?: string
): NormalizedIncident | null {
  if (!item?.id || !item?.name) return null;
  const updates: any[] = Array.isArray(item.updates) ? item.updates : [];
  const impacts: any[] = Array.isArray(item.component_impacts) ? item.component_impacts : [];
  const startedAt =
    impacts.map((i) => String(i?.start_at || '')).filter(Boolean).sort()[0] || String(item.published_at || '');
  if (!Number.isFinite(Date.parse(startedAt))) return null;
  const status = incidentStatusFrom(item.status);
  const lastUpdate = updates.map((u) => String(u?.published_at || '')).filter(Boolean).sort().pop();
  const impactEnd = impacts.map((i) => String(i?.end_at || '')).filter(Boolean).sort().pop();
  const resolvedAt = status === 'resolved' ? impactEnd || lastUpdate || undefined : undefined;
  const affected: any[] = Array.isArray(item.affected_components) ? item.affected_components : [];
  const severity = worst([...affected.map((c) => severityFrom(c?.status)), ...impacts.map((i) => severityFrom(i?.status))]);
  return {
    id: String(item.id),
    providerId,
    sourceId,
    title: String(item.name),
    status,
    severity: item.type === 'maintenance' ? 'maintenance' : severity === 'operational' ? 'degraded' : severity,
    startedAt: new Date(startedAt).toISOString(),
    updatedAt: new Date(lastUpdate || startedAt).toISOString(),
    resolvedAt: resolvedAt ? new Date(resolvedAt).toISOString() : undefined,
    impactedComponents: affected.map((c) => String(c?.component_id || '')).filter(Boolean),
    impactedComponentNames: affected.map((c) => names.get(String(c?.component_id)) || '').filter(Boolean),
    sourceStatus: typeof item.status === 'string' ? item.status : undefined,
    updates: updates
      .filter((u) => u?.id)
      .map((u) => ({
        id: String(u.id),
        status: incidentStatusFrom(u.to_status),
        body: String(u.message_string || ''),
        createdAt: new Date(String(u.published_at || startedAt)).toISOString(),
      })),
    rawUrl: pageUrl ? `${pageUrl.replace(/\/$/, '')}/incidents/${item.id}` : undefined,
  };
}
