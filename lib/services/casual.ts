import { getDb } from '@/lib/db/firestore';
import { config } from '@/lib/config';
import { intelligenceService } from '@/lib/services/intelligence';
import { providerService } from '@/lib/services/providers';
import type { NormalizedIncident } from '@/lib/types/ingestion';
import type {
  CasualAppConfig,
  ExperienceEvidence,
  OfficialNotice,
  ExperienceReportSummary,
  ExperienceSignal,
  ExperienceStatus,
  ExperienceSurfaceId,
  ExperienceSurfaceStatus,
} from '@/lib/types/casual';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { log } from '@/lib/utils/logger';

import translationRules from '@/lib/casual/translation_rules.json';
import guidanceCards from '@/lib/casual/guidance_cards.json';
import surfacesConfig from '@/lib/casual/surfaces.json';
import appsConfig from '@/lib/casual/apps.json';
import sourcesConfig from '@/lib/data/sources.json';

const REPORT_WINDOW_MINUTES = 10;
const BASELINE_WINDOW_MINUTES = 60;
const REPORT_RATE_LIMIT_MINUTES = 5;
const SELF_TEST_HEADER = 'x-aistatus-selftest';
// A page we haven't managed to read for two hours is treated as unreadable.
const OFFICIAL_FEED_STALE_MS = 2 * 60 * 60 * 1000;

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

function normalizeSurface(surface: ExperienceSurfaceId): ExperienceSurfaceId {
  return surface;
}

// What the provider's own page says, in our three words.
function officialSignal(status: string | undefined): ExperienceSignal {
  const s = String(status || '').toLowerCase();
  if (!s || s === 'unknown') return 'unknown';
  if (s === 'operational' || s === 'maintenance' || s === 'up') return 'operational';
  if (s.includes('major') || s === 'down' || s === 'outage') return 'down';
  return 'degraded';
}

// Providers whose page we read. A provider with no source publishes nothing.
function providerHasOfficialFeed(providerId: string): boolean {
  const sources = (sourcesConfig as { sources: Array<{ providerId: string }> }).sources || [];
  return sources.some((source) => source.providerId === providerId);
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
  return appsConfig.apps as CasualAppConfig[];
}

export function getCasualApp(appId: string): CasualAppConfig | undefined {
  return listCasualApps().find(
    (app) =>
      app.id.toLowerCase() === appId.toLowerCase() ||
      app.providerId.toLowerCase() === appId.toLowerCase()
  );
}

export async function getCasualStatus(options: { appId: string }): Promise<ExperienceStatus | null> {
  const app = getCasualApp(options.appId);
  if (!app) return null;
  try {
    const now = new Date();

    const [incidents, summaries] = await Promise.all([
      intelligenceService.getIncidents({ providerId: app.providerId, limit: 20 }),
      intelligenceService.getProviderSummaries().catch(() => []),
    ]);

    // "Up" is only an honest default when something is actually reporting.
    // Character.AI deleted its status page and we have no probe for it; the
    // site kept saying "up" on no evidence at all.
    const official = summaries.find((s) => s.providerId === app.providerId);
    const officialAgeMs = official?.lastUpdated ? now.getTime() - Date.parse(official.lastUpdated) : Infinity;
    const officialAlive = Boolean(official) && official!.status !== 'unknown' && officialAgeMs < OFFICIAL_FEED_STALE_MS;
    // The site consolidates what providers publish; it does not second-guess
    // them. The official page decides the verdict. Only a provider that
    // publishes no status page at all (Character.AI, Meta AI) is judged by
    // whether its app answers our reachability check.
    const hasOfficialFeed = providerHasOfficialFeed(app.providerId);
    const officialVerdict: ExperienceSignal | null = officialAlive ? officialSignal(official!.status) : null;

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

    // Open on the official page but silent for over a day: not evidence for
    // the verdict, but shown to the visitor as the provider's own word.
    const officialNotices: OfficialNotice[] = incidents
      .filter((incident) => {
        if (incident.resolvedAt) return false;
        if (['resolved', 'completed', 'cancelled'].includes(incident.status)) return false;
        const updated = Date.parse(incident.updatedAt || '');
        return Number.isFinite(updated) && Date.now() - updated > STALE_INCIDENT_MS;
      })
      .slice(0, 3)
      .map((incident) => ({
        id: incident.id,
        title: incident.title,
        status: incident.status,
        updated_at: incident.updatedAt,
        url: `/incidents/${incident.providerId}:${incident.id}`,
      }));

    const surfaceStatuses: ExperienceSurfaceStatus[] = [];
    for (const surfaceId of app.surfaces) {
      const surface = normalizeSurface(surfaceId);
      const surfaceConfig = (surfacesConfig.surfaces as any)[surface];
      let signalType: string | null = null;
      // Surfaces the official incidents don't single out inherit the page's
      // overall word; "unknown" means there is no page or we could not read it.
      let status: ExperienceSignal = hasOfficialFeed ? (officialVerdict ?? 'unknown') : 'unknown';

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
        if (!signalType && incidentSignal !== 'operational') {
          if (surface === 'login') signalType = 'auth';
          else if (surface === 'billing') signalType = 'billing';
          if (surface === 'images') signalType = 'image_fail';
          if (!signalType) {
            signalType = incidentSignal === 'down' ? 'errors' : 'latency';
          }
        }
      }

      // A page that says degraded without naming a surface: the generic
      // "errors" explanation is the honest one.
      if (hasOfficialFeed && !incidentSignal && (status === 'degraded' || status === 'down') && !signalType) {
        signalType = 'errors';
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
        confidence: officialAlive ? 0.9 : 0.2,
        updated_at: now.toISOString(),
        evidence,
        sources: ['official'],
      });
    }

    const overallStatus: ExperienceSignal = surfaceStatuses.some((s) => s.status === 'down')
      ? 'down'
      : surfaceStatuses.some((s) => s.status === 'degraded')
        ? 'degraded'
        : surfaceStatuses.some((s) => s.status === 'operational')
          ? 'operational'
          : 'unknown';

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
      official_notices: officialNotices,
      official_page: {
        exists: hasOfficialFeed,
        url: providerService.getProvider(app.providerId)?.statusPageUrl,
        read_at: official?.lastUpdated || undefined,
        says: official?.description || undefined,
        status: official?.status ? String(official.status) : undefined,
      },
    };
  } catch (error) {
    // We could not compute a verdict. That is not evidence of "up".
    log('error', 'Casual verdict failed', { appId: app.id, error: error instanceof Error ? error.message : String(error) });
    const now = new Date().toISOString();
    return {
      app_id: app.id,
      app_name: app.label,
      provider_id: app.providerId,
      overall_status: 'unknown',
      headline: translationRules.defaults.headline,
      symptoms: translationRules.defaults.symptoms,
      actions: translationRules.defaults.actions,
      confidence: 0.3,
      updated_at: now,
      surfaces: app.surfaces.map((surfaceId) => ({
        id: surfaceId,
        label: (surfacesConfig.surfaces as any)[surfaceId]?.label || surfaceId,
        status: 'unknown',
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
      official_notices: [],
      official_page: { exists: providerHasOfficialFeed(app.providerId) },
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
  const summaries = await intelligenceService.getProviderSummaries().catch(() => []);
  const byProvider = new Map(summaries.map((summary) => [summary.providerId, summary]));

  return listCasualApps()
    .filter((app) => app.id !== excludeAppId)
    .filter((app) => {
      const summary = byProvider.get(app.providerId);
      if (!summary || summary.status !== 'operational') return false;
      return !summary.activeIncidentCount;
    })
    .slice(0, limit)
    .map((app) => ({ id: app.id, label: app.label }));
}
