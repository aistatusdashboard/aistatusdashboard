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

// Rebuild config/popularity so the homepage board is ordered by true Google
// search popularity of each AI tool (lib/data/demand.json) — what the whole web
// searches, not just us. Our GSC impressions only break exact ties.
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

    // Order by true Google search popularity (lib/data/demand.json). Trends
    // can't compare the long tail directly against ChatGPT (it dwarfs them), so
    // demand.json is pulled by bridging through mid-tier anchors — giving a real
    // popularity value for all apps. Our GSC impressions only break exact ties.
    const demand = (demandConfig as { scores: Record<string, number> }).scores || {};
    const maxImp = Math.max(1, ...Object.values(imp));
    const gscTiebreak = (id: string) => ((imp[id] || 0) / (maxImp + 1)) * 1e-5;
    const score = (id: string) => (demand[id] || 0) + gscTiebreak(id);
    const order = apps.map((a) => a.id).sort((a, b) => score(b) - score(a));
    await getDb()
      .collection('config')
      .doc('popularity')
      .set({ order, updatedAt: new Date().toISOString(), source: 'trends_popularity_full' });

    return NextResponse.json({ ok: true, count: order.length, top: order.slice(0, 5) });
  } catch (e) {
    log('error', 'popularity refresh failed', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
