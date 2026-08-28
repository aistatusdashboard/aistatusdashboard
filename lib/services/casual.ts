import { TtlCache } from '@/lib/utils/ttl-cache';
import { readProbeRollup } from '@/lib/services/probe-store';
import { getDb } from '@/lib/db/firestore';
import { config } from '@/lib/config';
import { intelligenceService } from '@/lib/services/intelligence';
import { getOpenGaps } from '@/lib/services/gap-detector';
import { providerService } from '@/lib/services/providers';
import type { NormalizedIncident } from '@/lib/types/ingestion';
import type {
  CasualAppConfig,
  ExperienceEvidence,
  ExperienceReportSummary,
  ExperienceSignal,
  ExperienceStatus,
  ExperienceSurfaceId,
  ExperienceSurfaceStatus,
} from '@/lib/types/casual';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

import translationRules from '@/lib/casual/translation_rules.json';
import guidanceCards from '@/lib/casual/guidance_cards.json';
import surfacesConfig from '@/lib/casual/surfaces.json';
import appsConfig from '@/lib/casual/apps.json';

const DEFAULT_WINDOW_MINUTES = 30;
const REPORT_WINDOW_MINUTES = 10;
const BASELINE_WINDOW_MINUTES = 60;
const REPORT_RATE_LIMIT_MINUTES = 5;
const SELF_TEST_HEADER = 'x-aistatus-selftest';

const LATENCY_DEGRADED_MS = 4000;
const LATENCY_WARNING_MS = 2000;
const ERROR_RATE_DEGRADED = 0.05;
const THROTTLE_RATE_DEGRADED = 0.08;
const STREAM_DISCONNECT_DEGRADED = 0.03;

const SURFACE_KEYWORDS: Record<ExperienceSurfaceId, string[]> = {
  text: ['chat', 'message', 'response', 'completion', 'text'],
  images: ['image', 'vision', 'dall', 'generation', 'img'],
  voice: ['voice', 'audio', 'speech', 'listen'],
  browse: ['browse', 'web', 'search', 'internet'],
  tools: ['tool', 'function', 'assistant', 'connector', 'plugin'],
  login: ['login', 'auth', 'sign in', 'signin', 'session'],
  billing: ['billing', 'subscription', 'payment', 'plan', 'invoice'],
  rate_limits: ['rate limit', 'throttle', 'quota', '429'],
};

const REGION_ALIASES: Record<string, string> = {
  US: 'US',
  CA: 'US',
  GB: 'Europe',
  FR: 'Europe',
  DE: 'Europe',
  NL: 'Europe',
  IE: 'Europe',
  ES: 'Europe',
  IT: 'Europe',
  SE: 'Europe',
  NO: 'Europe',
  DK: 'Europe',
  FI: 'Europe',
  BR: 'South America',
  AR: 'South America',
  CL: 'South America',
  MX: 'North America',
  AU: 'Oceania',
  NZ: 'Oceania',
  IN: 'Asia',
  JP: 'Asia',
  KR: 'Asia',
  SG: 'Asia',
};

type MetricSummary = {
  latencyP95?: number;
  http429Rate?: number;
  http5xxRate?: number;
  streamDisconnectRate?: number;
  sampleCount: number;
  sources: string[];
};

function percentile(values: number[], p: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function average(values: Array<number | undefined>): number | undefined {
  const filtered = values.filter((v): v is number => typeof v === 'number');
  if (!filtered.length) return undefined;
  return filtered.reduce((acc, v) => acc + v, 0) / filtered.length;
}

function mapLatencyValue(event: any): number | undefined {
  if (typeof event.latencyP95 === 'number') return event.latencyP95;
  return typeof event.latencyMs === 'number' ? event.latencyMs : undefined;
}

function summarizeMetrics(records: Array<any>): MetricSummary {
  const latency = records.map(mapLatencyValue).filter((v): v is number => typeof v === 'number');
  return {
    latencyP95: percentile(latency, 95),
    http429Rate: average(records.map((r) => r.http429Rate)),
    http5xxRate: average(records.map((r) => r.http5xxRate)),
    streamDisconnectRate: average(records.map((r) => r.streamDisconnectRate)),
    sampleCount: records.length,
    sources: Array.from(new Set(records.map((r) => r.source).filter(Boolean))),
  };
}

function normalizeSurface(surface: ExperienceSurfaceId): ExperienceSurfaceId {
  return surface;
}

function resolveSignalType(summary: MetricSummary, surface: ExperienceSurfaceId): string | null {
  if (summary.http429Rate !== undefined && summary.http429Rate >= THROTTLE_RATE_DEGRADED) {
    return 'rate_limit';
  }
  if (summary.http5xxRate !== undefined && summary.http5xxRate >= ERROR_RATE_DEGRADED) {
    return 'errors';
  }
  if (summary.streamDisconnectRate !== undefined && summary.streamDisconnectRate >= STREAM_DISCONNECT_DEGRADED) {
    return 'streaming';
  }
  if (summary.latencyP95 !== undefined && summary.latencyP95 >= LATENCY_DEGRADED_MS) {
    return surface === 'images' ? 'image_fail' : 'latency';
  }
  if (summary.latencyP95 !== undefined && summary.latencyP95 >= LATENCY_WARNING_MS) {
    return surface === 'images' ? 'image_fail' : 'latency';
  }
  return null;
}

function resolveSignalStatus(summary: MetricSummary): ExperienceSignal {
  if (!summary.sampleCount) return 'unknown';
  if ((summary.http5xxRate || 0) >= ERROR_RATE_DEGRADED) return 'down';
  if ((summary.http429Rate || 0) >= THROTTLE_RATE_DEGRADED) return 'degraded';
  if ((summary.streamDisconnectRate || 0) >= STREAM_DISCONNECT_DEGRADED) return 'degraded';
  if ((summary.latencyP95 || 0) >= LATENCY_DEGRADED_MS) return 'degraded';
  return 'operational';
}

function pickTranslation(signalType: string | null, surface: ExperienceSurfaceId) {
  if (!signalType) {
    return translationRules.defaults;
  }
  if (signalType === 'auth' || surface === 'login') {
    return translationRules.signals.auth;
  }
  if (signalType === 'image_fail') {
    return translationRules.signals.image_fail;
  }
  if (signalType === 'rate_limit') {
    return translationRules.signals.rate_limit;
  }
  if (signalType === 'errors') {
    return translationRules.signals.errors;
  }
  if (signalType === 'streaming') {
    return translationRules.signals.streaming;
  }
  if (signalType === 'latency') {
    return translationRules.signals.latency;
  }
  return translationRules.defaults;
}

function pickGuidance(surface: ExperienceSurfaceId, signalType: string | null): string[] {
  if (!signalType) return [];
  return guidanceCards.cards
    .filter((card: any) => card.surfaces.includes(surface) && card.signals.includes(signalType))
    .flatMap((card: any) => card.steps);
}

function buildEvidence(providerId: string, incidents: NormalizedIncident[]): ExperienceEvidence[] {
  const provider = providerService.getProvider(providerId);
  const evidence: ExperienceEvidence[] = [];
  // Consumer-facing evidence only: the human-readable official page and any
  // active incident links — no raw JSON endpoints.
  if (provider?.statusPageUrl) {
    evidence.push({ label: 'Official status page', url: provider.statusPageUrl, type: 'official' });
  }
  incidents.slice(0, 2).forEach((incident) => {
    if (incident.rawUrl) {
      evidence.push({ label: incident.title, url: incident.rawUrl, type: 'incident' });
    }
  });
  return evidence;
}

function classifyIncidentSurface(incident: NormalizedIncident): ExperienceSurfaceId[] {
  const text = `${incident.title} ${(incident.impactedComponentNames || []).join(' ')} ${(incident.impactedComponents || []).join(' ')}`.toLowerCase();
  const matched: ExperienceSurfaceId[] = [];
  (Object.keys(SURFACE_KEYWORDS) as ExperienceSurfaceId[]).forEach((surface) => {
    if (SURFACE_KEYWORDS[surface].some((keyword) => text.includes(keyword))) {
      matched.push(surface);
    }
  });
  return matched.length ? matched : ['text'];
}

function computeIncidentSeverity(incident: NormalizedIncident): ExperienceSignal {
  if (incident.severity === 'major_outage') return 'down';
  if (incident.severity === 'partial_outage' || incident.severity === 'degraded') return 'degraded';
  if (incident.status === 'investigating' || incident.status === 'identified') return 'degraded';
  return 'operational';
}

function computeConfidence(samples: number, hasOfficial: boolean, hasReports: boolean): number {
  let confidence = 0.35;
  if (samples >= 10) confidence += 0.35;
  else if (samples >= 5) confidence += 0.2;
  else if (samples >= 1) confidence += 0.1;
  if (hasOfficial) confidence += 0.2;
  if (hasReports) confidence += 0.1;
  return Math.min(0.95, Math.max(0.2, confidence));
}

function summarizeRegions(reports: Array<{ region?: string }>): Array<{ region: string; count: number }> {
  const counts: Record<string, number> = {};
  reports.forEach((report) => {
    if (!report.region) return;
    const bucket = REGION_ALIASES[report.region] || report.region;
    counts[bucket] = (counts[bucket] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function resolveRegion(headers: Headers): string | undefined {
  const country = headers.get('x-vercel-ip-country') ||
    headers.get('x-appengine-country') ||
    headers.get('x-country-code') ||
    headers.get('cf-ipcountry');
  if (!country) return undefined;
  const trimmed = country.trim().toUpperCase();
  if (!trimmed || trimmed === 'XX') return undefined;
  return REGION_ALIASES[trimmed] || trimmed;
}

function hashToken(value: string): string {
  const salt = config.insights.telemetrySalt || 'ai-status-dashboard';
  return crypto.createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

export type CasualReportClassification =
  | 'self_test'
  | 'verified_external'
  | 'bot_or_automation'
  | 'indeterminate';

export function maskIpPrefix(ip: string): string {
  const normalized = ip.trim();
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (ipv4) {
    return `${ipv4[1]}.${ipv4[2]}.0.0/16`;
  }

  if (normalized.includes(':')) {
    const segments = normalized.split(':').filter(Boolean);
    if (segments.length >= 4) {
      return `${segments.slice(0, 4).join(':')}::/64`;
    }
  }

  return 'unknown';
}

export function classifyCasualReport(headers: Headers, ip: string, ua: string): {
  classification: CasualReportClassification;
  isSelfTest: boolean;
  clientHash: string;
  userAgentHash: string;
  ipPrefix: string;
} {
  const clientHash = hashToken(`${ip}:${ua}`);
  const userAgentHash = hashToken(ua);
  const ipPrefix = maskIpPrefix(ip);
  const isSelfTest = headers.get(SELF_TEST_HEADER) === '1';

  return {
    classification: isSelfTest ? 'self_test' : 'indeterminate',
    isSelfTest,
    clientHash,
    userAgentHash,
    ipPrefix,
  };
}

async function loadRecentTelemetry(providerId: string, since: Date, until: Date) {
  const db = getDb();
  let query: FirebaseFirestore.Query = db
    .collection('telemetry_events')
    .where('timestamp', '>=', Timestamp.fromDate(since))
    .where('timestamp', '<=', Timestamp.fromDate(until))
    .where('providerId', '==', providerId)
    .where('source', '==', 'crowd');
  try {
    const snapshot = await query.limit(800).get();
    return snapshot.docs.map((doc) => doc.data());
  } catch (error: any) {
    if (error?.code === 9 || error?.message?.includes('index')) {
      const fallback = await db.collection('telemetry_events').limit(300).get();
      return fallback.docs.map((doc) => doc.data()).filter((event) => {
        const ts = event.timestamp?.toDate?.()?.getTime?.() || 0;
        return ts >= since.getTime() && ts <= until.getTime() && event.providerId === providerId;
      });
    }
    throw error;
  }
}

const syntheticCache = new TtlCache<Array<FirebaseFirestore.DocumentData>>(240_000);

async function loadRecentSynthetic(providerId: string, since: Date, until: Date) {
  // Probes are written every 15 minutes; a 60s cache cannot go stale but keeps
  // repeated page renders from re-reading up to 800 documents each time.
  const cacheKey = `${providerId}:${Math.floor(since.getTime() / 60_000)}:${Math.floor(until.getTime() / 60_000)}`;
  return syntheticCache.wrap(cacheKey, () => loadRecentSyntheticUncached(providerId, since, until));
}

async function loadRecentSyntheticUncached(providerId: string, since: Date, until: Date) {
  // One document instead of a windowed scan of the probe collection.
  const rollup = await readProbeRollup(providerId).catch(() => null);
  if (rollup) {
    return rollup.filter((event) => {
      const ms = event?.timestamp?.toDate?.()?.getTime?.() ?? 0;
      return ms >= since.getTime() && ms <= until.getTime();
    });
  }

  const db = getDb();
  let query: FirebaseFirestore.Query = db
    .collection('synthetic_probes')
    .where('timestamp', '>=', Timestamp.fromDate(since))
    .where('timestamp', '<=', Timestamp.fromDate(until))
    .where('providerId', '==', providerId);
  try {
    const snapshot = await query.limit(800).get();
    return snapshot.docs.map((doc) => doc.data());
  } catch (error: any) {
    if (error?.code === 9 || error?.message?.includes('index')) {
      const fallback = await db.collection('synthetic_probes').limit(300).get();
      return fallback.docs.map((doc) => doc.data()).filter((event) => {
        const ts = event.timestamp?.toDate?.()?.getTime?.() || 0;
        return ts >= since.getTime() && ts <= until.getTime() && event.providerId === providerId;
      });
    }
    throw error;
  }
}

function matchesEndpoints(record: any, endpoints: string[]) {
  if (!endpoints.length) return true;
  const endpoint = String(record.endpoint || '').toLowerCase();
  return endpoints.some((value) => endpoint.includes(value));
}

function pickSurfaceEvents(events: any[], endpoints: string[]): any[] {
  return events.filter((event) => matchesEndpoints(event, endpoints));
}

function calculateTypicalResolution(incidents: NormalizedIncident[]): number | undefined {
  const durations = incidents
    .filter((incident) => incident.resolvedAt && incident.startedAt)
    .map((incident) => {
      const start = Date.parse(incident.startedAt);
      const end = Date.parse(incident.resolvedAt || '');
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      return Math.max(1, Math.round((end - start) / 60000));
    })
    .filter((value): value is number => typeof value === 'number');
  if (durations.length < 2) return undefined;
  const sorted = durations.sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function pickLastSimilar(incidents: NormalizedIncident[]): NormalizedIncident | undefined {
  return incidents.find((incident) => incident.resolvedAt || incident.updatedAt);
}

export function listCasualApps(): CasualAppConfig[] {
  const configured = appsConfig.apps as CasualAppConfig[];
  const byProvider = new Set(configured.map((app) => app.providerId));
  const providerDerived: CasualAppConfig[] = providerService
    .getProviders()
    .filter((provider) => !byProvider.has(provider.id))
    .map((provider) => {
      const label = `${provider.displayName || provider.name} Status`;
      return {
        id: provider.id,
        label,
        providerId: provider.id,
        providerDisplay: provider.displayName || provider.name,
        surfaces: ['text', 'tools', 'login', 'rate_limits'],
      };
    });
  return [...configured, ...providerDerived];
}

export function getCasualApp(appId: string): CasualAppConfig | undefined {
  return listCasualApps().find(
    (app) =>
      app.id.toLowerCase() === appId.toLowerCase() ||
      app.providerId.toLowerCase() === appId.toLowerCase()
  );
}

export async function getCasualStatus(options: { appId: string; windowMinutes?: number }): Promise<ExperienceStatus | null> {
  const app = getCasualApp(options.appId);
  if (!app) return null;
  try {
    const windowMinutes = options.windowMinutes || DEFAULT_WINDOW_MINUTES;
    const now = new Date();
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const [telemetryEvents, syntheticEvents, incidents] = await Promise.all([
      loadRecentTelemetry(app.providerId, since, now),
      loadRecentSynthetic(app.providerId, since, now),
      intelligenceService.getIncidents({ providerId: app.providerId, limit: 20 }),
    ]);

    const STALE_INCIDENT_MS = 24 * 60 * 60 * 1000;
    const activeIncidents = incidents.filter((incident) => {
      const status = incident.status;
      // An incident with a resolution timestamp is over, whatever its status
      // field says — some feeds (e.g. Google Cloud) leave status as "unknown".
      if (incident.resolvedAt) return false;
      if (['resolved', 'completed', 'cancelled'].includes(status)) return false;
      // An "investigating" incident with no update in 24h is a zombie (e.g. the
      // provider closed it without a final update); don't let it hold a verdict.
      const updated = Date.parse(incident.updatedAt || '');
      if (Number.isFinite(updated) && Date.now() - updated > STALE_INCIDENT_MS) return false;
      return true;
    });

    const surfaceStatuses: ExperienceSurfaceStatus[] = [];
    for (const surfaceId of app.surfaces) {
      const surface = normalizeSurface(surfaceId);
      const surfaceConfig = (surfacesConfig.surfaces as any)[surface];
      const endpoints: string[] = surfaceConfig?.endpoints || [];
      const syntheticScoped = pickSurfaceEvents(syntheticEvents, endpoints).map((event) => ({ ...event, source: 'synthetic' }));
      const telemetryScoped = pickSurfaceEvents(telemetryEvents, endpoints).map((event) => ({ ...event, source: 'crowd' }));
      const combined = [...syntheticScoped, ...telemetryScoped];

      const summary = summarizeMetrics(combined);
      let signalType = resolveSignalType(summary, surface);
      let status = resolveSignalStatus(summary);

      const matchingIncidents = activeIncidents.filter((incident) =>
        classifyIncidentSurface(incident).includes(surface)
      );
      let incidentSignal: ExperienceSignal | null = null;
      if (matchingIncidents.length) {
        incidentSignal = matchingIncidents.reduce<ExperienceSignal>((acc, incident) => {
          const next = computeIncidentSeverity(incident);
          if (next === 'down') return 'down';
          if (next === 'degraded' && acc !== 'down') return 'degraded';
          return acc;
        }, 'operational');
      }

      if (incidentSignal) {
        status = incidentSignal === 'down' ? 'down' : incidentSignal === 'degraded' ? 'degraded' : status;
        if (!signalType) {
          if (surface === 'login') signalType = 'auth';
          else if (surface === 'billing') signalType = 'billing';
          if (surface === 'images') signalType = 'image_fail';
          if (!signalType) {
            signalType = incidentSignal === 'down' ? 'errors' : 'latency';
          }
        }
      }

      if (summary.sampleCount < 3 && !incidentSignal) {
        status = 'operational';
        signalType = null;
      }
      if (status === 'unknown' && !incidentSignal) {
        status = 'operational';
      }

      const translation = pickTranslation(signalType, surface);
      const guidance = pickGuidance(surface, signalType);
      const symptoms = translation.symptoms.slice();
      const actions = translation.actions.concat(guidance).slice(0, 5);

      const evidence: ExperienceEvidence[] = buildEvidence(app.providerId, matchingIncidents);

      surfaceStatuses.push({
        id: surface,
        label: surfaceConfig?.label || surface,
        status,
        headline: translation.headline,
        symptoms,
        actions,
        confidence: computeConfidence(summary.sampleCount, Boolean(incidentSignal), false),
        updated_at: now.toISOString(),
        evidence,
        sources: summary.sources.length ? summary.sources : ['synthetic'],
        metrics: {
          latency_p95_ms: summary.latencyP95,
          http_429_rate: summary.http429Rate,
          http_5xx_rate: summary.http5xxRate,
          stream_disconnect_rate: summary.streamDisconnectRate,
          sample_count: summary.sampleCount,
        },
      });
    }

    const overallStatus: ExperienceSignal = surfaceStatuses.some((s) => s.status === 'down')
      ? 'down'
      : surfaceStatuses.some((s) => s.status === 'degraded')
        ? 'degraded'
        : 'operational';

    const worstSurface = surfaceStatuses.find((s) => s.status === 'down') ||
      surfaceStatuses.find((s) => s.status === 'degraded') ||
      surfaceStatuses[0];

    const evidence = buildEvidence(app.providerId, activeIncidents);
    const historyIncidents = incidents.slice(0, 20);
    const typicalMinutes = calculateTypicalResolution(historyIncidents);
    const lastSimilar = pickLastSimilar(historyIncidents);

    const reportSummary = await getReportSummary(app.id, surfaceStatuses.map((s) => s.id));

    return {
      app_id: app.id,
      app_name: app.label,
      provider_id: app.providerId,
      overall_status: overallStatus,
      headline: worstSurface?.headline || translationRules.defaults.headline,
      symptoms: worstSurface?.symptoms || translationRules.defaults.symptoms,
      actions: worstSurface?.actions || translationRules.defaults.actions,
      confidence: worstSurface ? worstSurface.confidence : 0.4,
      updated_at: now.toISOString(),
      surfaces: surfaceStatuses,
      is_it_just_me: reportSummary,
      history: {
        typical_resolution_minutes: typicalMinutes,
        last_similar_event: lastSimilar
          ? {
              title: lastSimilar.title,
              ended_at: lastSimilar.resolvedAt || lastSimilar.updatedAt,
              duration_minutes: lastSimilar.resolvedAt && lastSimilar.startedAt
                ? Math.max(1, Math.round((Date.parse(lastSimilar.resolvedAt) - Date.parse(lastSimilar.startedAt)) / 60000))
                : 0,
              url: lastSimilar.rawUrl || `/incidents/${lastSimilar.providerId}:${lastSimilar.id}`,
            }
          : undefined,
      },
      evidence,
    };
  } catch (error) {
    const now = new Date().toISOString();
    return {
      app_id: app.id,
      app_name: app.label,
      provider_id: app.providerId,
      overall_status: 'operational',
      headline: translationRules.defaults.headline,
      symptoms: translationRules.defaults.symptoms,
      actions: translationRules.defaults.actions,
      confidence: 0.3,
      updated_at: now,
      surfaces: app.surfaces.map((surfaceId) => ({
        id: surfaceId,
        label: (surfacesConfig.surfaces as any)[surfaceId]?.label || surfaceId,
        status: 'operational',
        headline: translationRules.defaults.headline,
        symptoms: translationRules.defaults.symptoms,
        actions: translationRules.defaults.actions,
        confidence: 0.3,
        updated_at: now,
        evidence: [],
        sources: [],
      })),
      is_it_just_me: {
        window_minutes: REPORT_WINDOW_MINUTES,
        reports: 0,
        likely_global: false,
        baseline_per_10m: 0,
        top_regions: [],
        note: 'We are not seeing widespread issues right now.',
      },
      history: {},
      evidence: [],
    };
  }
}

async function getReportSummary(appId: string, surfaces: ExperienceSurfaceId[]): Promise<ExperienceReportSummary> {
  const db = getDb();
  const sinceRecent = new Date(Date.now() - REPORT_WINDOW_MINUTES * 60 * 1000);
  const sinceBaseline = new Date(Date.now() - BASELINE_WINDOW_MINUTES * 60 * 1000);

  const fetchReports = async (since: Date) => {
    try {
      const snapshot = await db
        .collection('casual_reports')
        .where('appId', '==', appId)
        .where('createdAt', '>=', Timestamp.fromDate(since))
        .get();
      return snapshot.docs.map((doc) => doc.data());
    } catch (error: any) {
      if (error?.code === 9 || error?.message?.includes('index')) {
        const fallback = await db.collection('casual_reports').limit(200).get();
        return fallback.docs.map((doc) => doc.data()).filter((report) => {
          const ts = report.createdAt?.toDate?.()?.getTime?.() || 0;
          return ts >= since.getTime() && report.appId === appId;
        });
      }
      return [];
    }
  };

  const [recentReports, baselineReports] = await Promise.all([
    fetchReports(sinceRecent),
    fetchReports(sinceBaseline),
  ]);

  const recentIssues = recentReports.filter((r) => r.issue === true);
  const baselineIssues = baselineReports.filter((r) => r.issue === true);

  const baselinePer10m = baselineIssues.length / (BASELINE_WINDOW_MINUTES / REPORT_WINDOW_MINUTES || 1);

  const likelyGlobal =
    recentIssues.length >= 5 ||
    (recentIssues.length >= 3 && recentIssues.length >= baselinePer10m * 2);

  const note = likelyGlobal
    ? 'Reports suggest a broader issue.'
    : recentIssues.length === 0
      ? 'No recent issue reports from other users.'
      : 'Mixed signals; could be localized.';

  return {
    window_minutes: REPORT_WINDOW_MINUTES,
    reports: recentIssues.length,
    likely_global: likelyGlobal,
    baseline_per_10m: Number(baselinePer10m.toFixed(1)),
    top_regions: summarizeRegions(recentIssues),
    note,
  };
}

export async function submitCasualReport(options: {
  appId: string;
  surface: ExperienceSurfaceId;
  issue: boolean;
  issueType?: string;
  region?: string;
  clientType?: string;
  headers: Headers;
}) {
  const app = getCasualApp(options.appId);
  if (!app) return { ok: false, status: 404, message: 'Unknown app.' };
  const surface = normalizeSurface(options.surface);
  if (!(surfacesConfig.surfaces as any)[surface]) {
    return { ok: false, status: 400, message: 'Unknown surface.' };
  }
  const db = getDb();

  const ip = options.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || options.headers.get('x-real-ip') || 'unknown';
  const ua = options.headers.get('user-agent') || 'unknown';
  const classification = classifyCasualReport(options.headers, ip, ua);

  const region = options.region || resolveRegion(options.headers) || 'global';

  const bucket = Math.floor(Date.now() / (REPORT_RATE_LIMIT_MINUTES * 60 * 1000));
  const lockId = `${classification.clientHash}:${app.id}:${surface}:${bucket}`;
  const lockRef = db.collection('casual_report_locks').doc(lockId);

  try {
    await lockRef.create({
      createdAt: FieldValue.serverTimestamp(),
      appId: app.id,
      surface,
    });
  } catch (error: any) {
    if (error?.code === 6) {
      return { ok: false, status: 429, message: 'Please wait before submitting again.' };
    }
  }

  await db.collection('casual_reports').add({
    appId: app.id,
    surface,
    issue: options.issue,
    issueType: options.issueType || null,
    region,
    clientType: options.clientType || 'web',
    clientHash: classification.clientHash,
    userAgentHash: classification.userAgentHash,
    ipPrefix: classification.ipPrefix,
    classification: classification.classification,
    isSelfTest: classification.isSelfTest,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, status: 200 };
}

// "What's still working" only needs a yes/no per app. Computing a full verdict
// for all 25 other apps (the old approach) meant thousands of document reads on
// every app-page render; provider_status is one query and is the same source
// the verdicts are built from.
export async function listUpAlternatives(
  excludeAppId: string,
  limit = 4
): Promise<Array<{ id: string; label: string }>> {
  const [summaries, openGaps] = await Promise.all([
    intelligenceService.getProviderSummaries().catch(() => []),
    getOpenGaps().catch(() => []),
  ]);
  const byProvider = new Map(summaries.map((summary) => [summary.providerId, summary]));
  const gapped = new Set(openGaps.map((gap) => gap.providerId));

  return listCasualApps()
    .filter((app) => app.id !== excludeAppId)
    .filter((app) => {
      const summary = byProvider.get(app.providerId);
      if (!summary || summary.status !== 'operational') return false;
      if (summary.activeIncidentCount) return false;
      // Our own probes disagreeing with the official page also disqualifies it.
      return !gapped.has(app.providerId);
    })
    .slice(0, limit)
    .map((app) => ({ id: app.id, label: app.label }));
}
