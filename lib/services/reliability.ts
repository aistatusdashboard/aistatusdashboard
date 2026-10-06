import { intelligenceService } from '@/lib/services/intelligence';
import { listCasualApps } from '@/lib/services/casual';
import sourcesConfig from '@/lib/data/sources.json';
import { TtlCache } from '@/lib/utils/ttl-cache';

// 30-day reliability ranking computed from ingested incident history.
// One row per status feed: apps sharing a provider (ChatGPT/Sora) are ranked
// once under the app listed first in the config.

const WINDOW_DAYS = 30;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;
// A single incident longer than this is almost always a bookkeeping artifact
// (never-resolved doc), so cap what one incident can contribute.
const MAX_INCIDENT_MS = 24 * 60 * 60 * 1000;

export type ReliabilityRow = {
  appId: string;
  limitedData?: boolean;
  name: string;
  providerId: string;
  uptimePct: number;
  incidentCount: number;
  downtimeMinutes: number;
  longestIncidentMinutes: number;
  lastIncidentAt: string | null;
  siblings: string[];
};

// Downtime weighted by severity: a full outage is 100% down, a partial outage
// counts less, and a minor "degraded" blip (elevated errors on one model) is
// not the service being down — so it barely moves uptime. Without this, a
// transparent provider that posts many small incidents (Anthropic, OpenAI)
// looks less reliable than an opaque one that posts nothing.
function baseWeight(severity: string | undefined): number {
  switch (severity) {
    case 'major_outage':
      return 1;
    case 'partial_outage':
      return 0.5;
    case 'degraded':
      return 0.15;
    case 'maintenance':
      return 0;
    default:
      return 0.15;
  }
}

// Providers label severity inconsistently (MiniMax/Moonshot mark "elevated
// error rate" as major/critical; Anthropic calls the same thing degraded).
// For the cross-provider ranking, cap the weight when the incident text plainly
// describes a partial degradation rather than a full outage — so the comparison
// is apples-to-apples and doesn't punish providers who label honestly.
const DEGRADATION_HINT = /elevated (error|latenc)|increased (error|latenc)|degrad|slow|partial|minor|intermittent|error rate/i;
function severityWeight(severity: string | undefined, title?: string): number {
  const w = baseWeight(severity);
  if (w >= 1 && title && DEGRADATION_HINT.test(title)) return 0.15;
  if (w >= 0.5 && title && DEGRADATION_HINT.test(title)) return 0.15;
  return w;
}

// Providers whose only source is a public endpoint (up/down probe) can never
// record an incident, so a perfect uptime for them is absence of data, not
// evidence of reliability. Flag them so the ranking can say so.
const ENDPOINT_ONLY = new Set(
  ((sourcesConfig as { sources: Array<{ providerId: string; platform?: string }> }).sources || [])
    .filter((src) => src.platform === 'endpoint')
    .map((src) => src.providerId)
);

export async function getReliabilityRanking(): Promise<ReliabilityRow[]> {
  const apps = listCasualApps();
  const byProvider = new Map<string, { appId: string; name: string; siblings: string[] }>();
  for (const app of apps) {
    const existing = byProvider.get(app.providerId);
    const name = app.label.replace(' Status', '');
    if (existing) existing.siblings.push(name);
    else byProvider.set(app.providerId, { appId: app.id, name, siblings: [] });
  }

  const now = Date.now();
  const since = now - WINDOW_MS;

  const rows = await Promise.all(
    Array.from(byProvider.entries()).map(async ([providerId, meta]) => {
      let incidents: Awaited<ReturnType<typeof intelligenceService.getIncidents>> = [];
      try {
        incidents = await intelligenceService.getIncidents({ providerId, limit: 200 });
      } catch {
        incidents = [];
      }

      let downtimeMs = 0;
      let longestMs = 0;
      let count = 0;
      let lastIncidentAt: string | null = null;

      for (const incident of incidents) {
        const started = Date.parse(incident.startedAt || '');
        if (!Number.isFinite(started) || started < since) continue;
        const resolvedRaw = incident.resolvedAt ? Date.parse(incident.resolvedAt) : NaN;
        const updated = Date.parse(incident.updatedAt || '');
        // Unresolved + silent for 24h = zombie; treat as ended at last update.
        const ended = Number.isFinite(resolvedRaw)
          ? resolvedRaw
          : Number.isFinite(updated) && now - updated > MAX_INCIDENT_MS
            ? updated
            : now;
        const rawDuration = Math.min(Math.max(ended - started, 0), MAX_INCIDENT_MS);
        const duration = rawDuration * severityWeight(incident.severity, incident.title);
        downtimeMs += duration;
        longestMs = Math.max(longestMs, rawDuration);
        count += 1;
        if (!lastIncidentAt || started > Date.parse(lastIncidentAt)) {
          lastIncidentAt = incident.startedAt;
        }
      }

      const uptimePct = Math.max(0, 100 * (1 - downtimeMs / WINDOW_MS));
      const limitedData = ENDPOINT_ONLY.has(providerId);
      return {
        limitedData,
        appId: meta.appId,
        name: meta.name,
        providerId,
        uptimePct,
        incidentCount: count,
        downtimeMinutes: Math.round(downtimeMs / 60000),
        longestIncidentMinutes: Math.round(longestMs / 60000),
        lastIncidentAt,
        siblings: meta.siblings,
      };
    })
  );

  return rows.sort(
    (a, b) =>
      Number(Boolean(a.limitedData)) - Number(Boolean(b.limitedData)) ||
      b.uptimePct - a.uptimePct ||
      a.incidentCount - b.incidentCount ||
      a.name.localeCompare(b.name)
  );
}

// The ranking is reused on every app page (for that app's uptime block and
// its rank), so cache it briefly rather than recomputing every provider per render.
const rankingCache = new TtlCache<ReliabilityRow[]>(1800_000, 1);

export async function getReliabilityRankingCached(): Promise<ReliabilityRow[]> {
  const hit = rankingCache.get('all');
  if (hit) return hit;
  const rows = await getReliabilityRanking();
  if (rows.length) rankingCache.set('all', rows);
  return rows;
}

export type AppReliability = {
  windowDays: number;
  limitedData: boolean;
  uptimePct: number;
  incidentCount: number;
  downtimeMinutes: number;
  longestIncidentMinutes: number;
  lastIncidentAt: string | null;
  rank: number | null;
  total: number;
};

// One app's 30-day reliability plus where it ranks among all tracked apps.
export async function getAppReliability(providerId: string): Promise<AppReliability | null> {
  const rows = await getReliabilityRankingCached().catch(() => []);
  if (!rows.length) return null;
  const index = rows.findIndex((row) => row.providerId === providerId);
  if (index < 0) return null;
  const row = rows[index];
  return {
    windowDays: WINDOW_DAYS,
    limitedData: Boolean(row.limitedData),
    uptimePct: row.uptimePct,
    incidentCount: row.incidentCount,
    downtimeMinutes: row.downtimeMinutes,
    longestIncidentMinutes: row.longestIncidentMinutes,
    lastIncidentAt: row.lastIncidentAt,
    rank: index + 1,
    total: rows.length,
  };
}
