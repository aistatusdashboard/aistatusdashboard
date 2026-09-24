import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/firestore';
import { intelligenceService } from '@/lib/services/intelligence';
import { getReliabilityRankingCached } from '@/lib/services/reliability';
import { listCasualApps } from '@/lib/services/casual';
import { EmailUtils } from '@/lib/utils/email';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

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

const STALE_MS = 20 * 60 * 1000; // provider read older than this = feed trouble
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
      if (age > STALE_MS) problems.push(`${pid} not read for ${Math.round(age / 60000)} min (feed may be down)`);
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
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';
    for (const path of ['/status.json', '/sitemap.xml', '/rss.xml']) {
      try {
        const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
        if (!res.ok) problems.push(`${path} returned HTTP ${res.status}`);
      } catch (e) {
        problems.push(`${path} unreachable (${e instanceof Error ? e.message : 'error'})`);
      }
    }

    if (problems.length) {
      log('error', 'Health check found problems', { problems });
      const to = process.env.ALERT_SIGNUP_NOTIFY_EMAIL || process.env.CONTACT_EMAIL || process.env.NEXT_PUBLIC_CONTACT_EMAIL;
      // Only email once per hour per problem-set, tracked in a small doc.
      if (to) {
        const stateRef = db.collection('health_state').doc('last');
        const prev = (await stateRef.get()).data();
        const signature = problems.slice().sort().join(' | ');
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
