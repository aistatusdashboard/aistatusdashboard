import type { NormalizedComponent, NormalizedIncident, NormalizedIncidentStatus, NormalizedSeverity } from '@/lib/types/ingestion';
import type { BrowserFeedSnapshot } from '@/lib/services/feed-snapshots';

// Rootly-hosted status pages (status.mistral.ai) rendered by the browser
// feed job. The page shows an overall banner, one row per service, and an
// incident history where each card carries a title, a status word, the
// latest update text and a single displayed timestamp.

function severityFrom(raw: string): NormalizedSeverity {
  const s = raw.toLowerCase();
  if (!s || s === 'operational') return 'operational';
  if (s.includes('major') || s.includes('outage')) return 'major_outage';
  if (s.includes('partial')) return 'partial_outage';
  if (s.includes('maint')) return 'maintenance';
  if (s.includes('degrad') || s.includes('affected')) return 'degraded';
  return 'degraded';
}

function worst(severities: NormalizedSeverity[]): NormalizedSeverity {
  const rank: Record<NormalizedSeverity, number> = { operational: 0, unknown: 0, maintenance: 1, degraded: 2, partial_outage: 3, major_outage: 4 };
  return severities.reduce<NormalizedSeverity>((acc, s) => (rank[s] > rank[acc] ? s : acc), 'operational');
}

function incidentStatusFrom(raw: string): NormalizedIncidentStatus {
  const s = raw.toLowerCase();
  if (s.includes('resolved') || s.includes('completed')) return 'resolved';
  if (s.includes('identified')) return 'identified';
  if (s.includes('monitoring')) return 'monitoring';
  return 'investigating';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseRootlySnapshot(
  snapshot: BrowserFeedSnapshot
): { status: NormalizedSeverity; components: NormalizedComponent[]; incidents: NormalizedIncident[] } {
  const { providerId, sourceId } = snapshot;
  const components: NormalizedComponent[] = snapshot.components
    .filter((c) => c && typeof c.name === 'string' && c.name.trim())
    .map((c) => ({
      id: `${providerId}:${slug(c.name)}`,
      providerId,
      name: c.name.trim(),
      status: severityFrom(String(c.status || '')),
    }));

  const incidents: NormalizedIncident[] = snapshot.incidents
    .filter((i) => i && typeof i.title === 'string' && Number.isFinite(Date.parse(i.shownAt)))
    .map((i) => {
      const status = incidentStatusFrom(String(i.status || ''));
      const shown = new Date(i.shownAt).toISOString();
      const started =
        typeof i.durationMinutes === 'number' && i.durationMinutes > 0
          ? new Date(Date.parse(shown) - i.durationMinutes * 60_000).toISOString()
          : shown;
      return {
        id: String(i.id || slug(`${i.title}-${shown}`)),
        providerId,
        sourceId,
        title: i.title.trim(),
        status,
        severity: 'degraded' as NormalizedSeverity,
        startedAt: started,
        updatedAt: shown,
        resolvedAt: status === 'resolved' ? shown : undefined,
        sourceStatus: i.status,
        updates: i.message
          ? [{ id: `${i.id}:latest`, status, body: i.message, createdAt: shown }]
          : [],
        rawUrl: i.url,
      };
    });

  const overall = snapshot.overall.toLowerCase();
  const fromBanner: NormalizedSeverity = overall.includes('all systems operational')
    ? 'operational'
    : overall.includes('major') || overall.includes('outage')
      ? 'major_outage'
      : overall.includes('partial')
        ? 'partial_outage'
        : overall.includes('maint')
          ? 'maintenance'
          : overall
            ? 'degraded'
            : 'unknown';
  const openIncident = incidents.some((i) => i.status !== 'resolved');
  const status = worst([
    fromBanner === 'unknown' ? 'operational' : fromBanner,
    ...components.map((c) => c.status),
    ...(openIncident ? (['degraded'] as NormalizedSeverity[]) : []),
  ]);

  return { status: fromBanner === 'unknown' && !components.length ? 'unknown' : status, components, incidents };
}
