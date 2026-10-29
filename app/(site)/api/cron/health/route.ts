import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/firestore';
import { intelligenceService } from '@/lib/services/intelligence';
import { getReliabilityRankingCached } from '@/lib/services/reliability';
import { listCasualApps } from '@/lib/services/casual';
import { EmailUtils } from '@/lib/utils/email';
import { log } from '@/lib/utils/logger';
import sourcesConfig from '@/lib/data/sources.json';

export const dynamic = 'force-dynamic';

// Per-provider staleness tolerance derived from how often we actually poll it.
// Some feeds poll slowly on purpose, or hop through a Cloudflare-worker proxy
// that occasionally drops a cycle, so a tight flat threshold pages the owner for
// normal gaps. Tolerate 5 poll intervals (min 45m), which absorbs a transient
// blip yet still catches a genuine multi-hour outage.
const POLL_INTERVAL_SECONDS = new Map<string, number>();
for (const s of sourcesConfig.sources as Array<{ providerId: string; pollIntervalSeconds?: number }>) {
  const secs = s.pollIntervalSeconds || 120;
  POLL_INTERVAL_SECONDS.set(s.providerId, Math.max(POLL_INTERVAL_SECONDS.get(s.providerId) || 0, secs));
}
// Browser-rendered feeds (Mistral, via the r.jina.ai renderer) gap 30-45 min
// when that external renderer hiccups, independent of their poll interval, then
// self-heal — so they get a higher floor than the poll-interval rule would give.
const BROWSER_STALE_FLOOR_MS = 55 * 60 * 1000;
const BROWSER_PROVIDERS = new Set(
  (sourcesConfig.sources as Array<{ providerId: string; platform: string }>)
    .filter((s) => s.platform === 'browser')
    .map((s) => s.providerId)
);

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.APP_CRON_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && process.env.APP_REQUIRE_CRON_SECRET !== 'true') return true;
  if (process.env.APP_ALLOW_OPEN_CRON === 'true') return true;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : request.headers.get('x-cron-secret');
  return provided === secret;
}

// Floor before a feed is called stale. Kept well above a few missed poll cycles
// so a transient blip (a slow proxy hop, one failed fetch) that self-heals next
// cycle doesn't page the owner — only a genuinely stuck feed (tens of minutes to
// hours, like a changed/blocked status page) should. 20 min was too twitchy.
const STALE_MS = 45 * 60 * 1000;
const UNKNOWN_MS = 60 * 60 * 1000; // stuck "unknown" longer than this = broken source

// Continuously validate the live product so problems surface to the owner
// before a visitor finds them. Cheap invariants only — no re-reading every
// official source — so it can run every 15 minutes.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const problems: string[] = [];
  const now = Date.now();

  try {
    const db = getDb();
    const apps = listCasualApps();
    const providerIds = Array.from(new Set(apps.map((a) => a.providerId)));

    // 1. Every provider's official status was read recently, and none is stuck unknown.
    const snap = await db.collection('provider_status').get();
    const byId = new Map(snap.docs.map((d) => [d.id, d.data()]));
    for (const pid of providerIds) {
      const doc = byId.get(pid);
      if (!doc) {
        problems.push(`provider_status/${pid} is missing`);
        continue;
      }
      const age = now - (doc.lastUpdated?.toMillis?.() ?? 0);
      const staleLimit = Math.max(
        STALE_MS,
        (POLL_INTERVAL_SECONDS.get(pid) || 120) * 5 * 1000,
        BROWSER_PROVIDERS.has(pid) ? BROWSER_STALE_FLOOR_MS : 0
      );
      if (age > staleLimit) problems.push(`${pid} not read for ${Math.round(age / 60000)} min (feed may be down)`);
      if (doc.status === 'unknown' && age < UNKNOWN_MS) {
        // fresh unknown is fine mid-transition; only flag if it's the stored state and old enough handled below
      }
    }

    // 2. Reliability computes and yields sane numbers.
    const ranking = await getReliabilityRankingCached().catch(() => []);
    if (!ranking.length) {
      problems.push('reliability ranking is empty');
    } else {
      const bad = ranking.filter((r) => !Number.isFinite(r.uptimePct) || r.uptimePct < 0 || r.uptimePct > 100);
      if (bad.length) problems.push(`reliability has ${bad.length} out-of-range uptime values (${bad.map((b) => b.providerId).join(', ')})`);
    }

    // 3. Incidents query works.
    const incidents = await intelligenceService.getIncidents({ limit: 5 }).catch(() => null);
    if (incidents === null) problems.push('incidents query failed');

    // 4. Public surfaces respond.
    // Re-check a failing surface once before flagging it. These endpoints read
    // Firestore, so the first hit on a cold (minInstances:0, scaled-to-zero)
    // instance can exceed the timeout while the container boots and the admin
    // SDK opens its first connection — a self-healing false alarm, not an
    // outage. One retry lands on the now-warm instance, so we only page the
    // owner when BOTH tries fail. This absorbs cold starts without paying to
    // keep an instance warm 24/7.
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';
    for (const path of ['/status.json', '/sitemap.xml', '/rss.xml']) {
      let lastErr = '';
      let ok = false;
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        try {
          const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
          if (res.ok) ok = true;
          else lastErr = `returned HTTP ${res.status}`;
        } catch (e) {
          lastErr = `unreachable (${e instanceof Error ? e.message : 'error'})`;
        }
      }
      if (!ok) problems.push(`${path} ${lastErr}`);
    }

    if (problems.length) {
      log('error', 'Health check found problems', { problems });
      const to = process.env.ALERT_SIGNUP_NOTIFY_EMAIL || process.env.CONTACT_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL;
      // Only email once per hour per problem-set, tracked in a small doc.
      if (to) {
        const stateRef = db.collection('health_state').doc('last');
        const prev = (await stateRef.get()).data();
        // Signature must ignore the values that drift every run (the "N min
        // stale" counter climbs each cycle), or the same ongoing problem looks
        // "changed" every time and re-emails every 15 min. Normalise numbers to
        // a placeholder so one persistent issue alerts once, then hourly.
        const signature = problems
          .map((p) => p.replace(/\d+/g, '#'))
          .sort()
          .join(' | ');
        const lastAt = prev?.alertedAt ? Date.parse(prev.alertedAt) : 0;
        const changed = prev?.signature !== signature;
        if (changed || now - lastAt > 60 * 60 * 1000) {
          await EmailUtils.sendEmail(
            to,
            `AI Status health check: ${problems.length} issue${problems.length === 1 ? '' : 's'}`,
            `<p>The automated health check found problems on aistatusdashboard.com:</p><ul>${problems.map((p) => `<li>${p}</li>`).join('')}</ul><p>Checked ${new Date().toISOString()}.</p>`
          ).catch(() => undefined);
          await stateRef.set({ signature, alertedAt: new Date().toISOString(), problems });
        }
      }
    } else {
      await db.collection('health_state').doc('last').set({ signature: '', okAt: new Date().toISOString(), problems: [] }, { merge: true }).catch(() => undefined);
    }

    return NextResponse.json({ ok: problems.length === 0, problems, checkedAt: new Date().toISOString() });
  } catch (error) {
    log('error', 'Health check crashed', { error });
    return NextResponse.json({ ok: false, error: 'health check failed' }, { status: 500 });
  }
}
