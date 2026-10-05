import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth, Impersonated } from 'google-auth-library';
import { getDb } from '@/lib/db/firestore';
import appsConfig from '@/lib/casual/apps.json';
import demandConfig from '@/lib/data/demand.json';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const SITE = 'https://aistatusdashboard.com/';
const GA_ADMIN = 'ga-admin@ai-status-dashboard.iam.gserviceaccount.com';

function requireCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET || process.env.APP_CRON_SECRET;
  const allowOpen = process.env.APP_ALLOW_OPEN_CRON === 'true';
  const isProd = process.env.NODE_ENV === 'production';
  const requireInDev = process.env.APP_REQUIRE_CRON_SECRET === 'true';
  if (!isProd && !requireInDev) return null;
  if (allowOpen) return null;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET required' }, { status: 503 });
  const bearer = request.headers.get('authorization')?.startsWith('Bearer ')
    ? request.headers.get('authorization')!.slice('Bearer '.length)
    : null;
  const provided = bearer || request.headers.get('x-cron-secret');
  if (provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

// Impersonate the ga-admin SA (which has Search Console access) to read our own
// search performance. The runtime SA has Token Creator on ga-admin.
async function searchConsoleToken(): Promise<string> {
  const source = await new GoogleAuth().getClient();
  const target = new Impersonated({
    sourceClient: source as any,
    targetPrincipal: GA_ADMIN,
    lifetime: 300,
    delegates: [],
    targetScopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const res = await target.getAccessToken();
  const token = typeof res === 'string' ? res : res.token;
  if (!token) throw new Error('failed to mint Search Console token');
  return token;
}

// Rebuild config/popularity so the homepage board is ordered by REAL public
// search demand. Primary signal: Google Trends interest for "is <app> down"
// (lib/data/demand.json) — what the whole web searches, not just us. Our own
// Search Console impressions (below) only break ties within an equal demand
// band, so a page we happen to rank well for can't jump a genuinely bigger app.
export async function GET(request: NextRequest) {
  const unauth = requireCronAuth(request);
  if (unauth) return unauth;

  try {
    const token = await searchConsoleToken();
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['page'], rowLimit: 1000 }),
        signal: AbortSignal.timeout(30_000),
      }
    );
    if (!res.ok) throw new Error(`Search Console API ${res.status}`);
    const data = (await res.json()) as { rows?: { keys: string[]; impressions: number }[] };
    const rows = data.rows || [];

    const apps = appsConfig.apps as Array<{ id: string; providerId: string }>;
    const appSet = new Set(apps.map((a) => a.id));
    const provToApp: Record<string, string> = {};
    apps.forEach((a) => {
      if (!provToApp[a.providerId]) provToApp[a.providerId] = a.id;
    });

    const imp: Record<string, number> = {};
    for (const r of rows) {
      const p = (r.keys[0] || '').replace('https://aistatusdashboard.com', '');
      const appMatch = p.match(/^\/([a-z0-9-]+)\/?$/);
      if (appMatch && appSet.has(appMatch[1])) {
        imp[appMatch[1]] = (imp[appMatch[1]] || 0) + r.impressions;
        continue;
      }
      const incMatch = p.match(/^\/incidents\/([a-z0-9-]+):/);
      if (incMatch) {
        const aid = provToApp[incMatch[1]];
        if (aid) imp[aid] = (imp[aid] || 0) + r.impressions * 0.5; // incidents count half
      }
    }

    // Blend. Google Trends measures true global demand but only resolves the
    // head: below ~1% of ChatGPT's "is X down" volume it quantizes to ~0, so a
    // genuinely surging niche app (e.g. muse — hundreds of real "is muse down"
    // searches) reads as 0 and noise-level Trends values would otherwise park
    // dead apps above it. So: where Trends has real signal (>= TREND_FLOOR),
    // rank by it; below the noise floor, rank by MEASURED outage-search demand
    // (our GSC impressions, which are real "is X down" queries that reached us).
    const demand = (demandConfig as { scores: Record<string, number> }).scores || {};
    const TREND_FLOOR = 0.01; // 1% of ChatGPT = Trends' reliable resolution
    const maxImp = Math.max(1, ...Object.values(imp));
    const gscShare = (id: string) => (imp[id] || 0) / (maxImp + 1); // 0..1
    const score = (id: string) =>
      (demand[id] || 0) >= TREND_FLOOR
        ? 100 + (demand[id] || 0) * 100 + gscShare(id) // trusted head, GSC breaks ties
        : gscShare(id); // Trends-blind tail: order by real outage-search demand
    const order = apps.map((a) => a.id).sort((a, b) => score(b) - score(a));
    await getDb()
      .collection('config')
      .doc('popularity')
      .set({ order, updatedAt: new Date().toISOString(), source: 'trends_demand_x_gsc_tiebreak' });

    return NextResponse.json({ ok: true, count: order.length, top: order.slice(0, 5) });
  } catch (e) {
    log('error', 'popularity refresh failed', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
