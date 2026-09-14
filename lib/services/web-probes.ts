import appsConfig from '@/lib/casual/apps.json';
import type { SyntheticProbeEvent } from '@/lib/types/insights';

// Zero-cost independent test for every app: fetch its public front door (or
// an unchallenged backend endpoint when the front door sits behind a bot
// wall). No API keys, no credits, no plan — just "does it answer".
// Only Sora and Midjourney have no unchallenged endpoint at all; they rest on
// their official feeds (and, for Sora, the OpenAI API probes).
//
// A bot challenge is not an outage and not our fault either: it is
// classified `bot_wall` and ignored by every consumer of probe evidence.

type AppEntry = { id: string; providerId: string; webUrl?: string; probeUrl?: string; probeExpect?: number[] };
const APPS: AppEntry[] = ((appsConfig as any).apps ?? appsConfig) as AppEntry[];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
const TIMEOUT_MS = 20_000;
const CHALLENGE_MARKERS = [
  'just a moment',
  'cf-challenge',
  'verifying you are human',
  'enable javascript and cookies',
  'attention required',
  'checking your browser',
];

export type WebProbeResult = { providerId: string; appId: string; url: string; event: SyntheticProbeEvent };

async function probeOne(app: AppEntry): Promise<WebProbeResult | null> {
  const url = app.probeUrl || app.webUrl;
  if (!url) return null;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const event: SyntheticProbeEvent = {
    providerId: app.providerId,
    model: 'web',
    endpoint: 'web',
    region: 'global',
    tier: 'unknown',
    streaming: false,
    timestamp: new Date().toISOString(),
    latencyMs: 0,
  };
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
      cache: 'no-store',
    });
    event.latencyMs = Date.now() - startedAt;
    const body = (await response.text().catch(() => '')).slice(0, 4000).toLowerCase();
    const challenged = CHALLENGE_MARKERS.some((m) => body.includes(m));

    // Some backends answer an unauthenticated ping with 401/405; when the
    // app config says so, that is the healthy answer.
    const expected = app.probeUrl && Array.isArray(app.probeExpect) && app.probeExpect.includes(response.status);
    if (expected) {
      // healthy
    } else if (challenged || response.status === 403 || response.status === 429) {
      event.errorCode = 'bot_wall';
    } else if (response.status === 404 || response.status === 410) {
      event.errorCode = `http-${response.status}`; // our URL is wrong → owner alert
    } else if (response.status >= 500) {
      event.errorCode = `http-${response.status}`;
      event.http5xxRate = 1;
    }
  } catch (error: any) {
    event.latencyMs = Date.now() - startedAt;
    const code = String(error?.cause?.code || error?.code || '');
    const message = String(error?.message || error);
    if (code === 'UND_ERR_HEADERS_OVERFLOW') {
      // The server answered — its headers just exceed our parser's limit
      // (Google properties do this). That is an "up", not a failure.
    } else if (/abort/i.test(message)) {
      event.errorCode = 'timeout';
    } else if (/ENOTFOUND|EAI_AGAIN/.test(code)) {
      event.errorCode = 'dns';
    } else {
      event.errorCode = 'network';
    }
  } finally {
    clearTimeout(timer);
  }
  return { providerId: app.providerId, appId: app.id, url, event };
}

export async function runWebProbes(): Promise<WebProbeResult[]> {
  const results = await Promise.allSettled(APPS.map(probeOne));
  return results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((r): r is WebProbeResult => r !== null);
}
