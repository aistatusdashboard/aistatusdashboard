import { NextResponse } from 'next/server';
import { getCasualStatus, listCasualApps } from '@/lib/services/casual';
import { shortName, verdictKey } from '@/lib/ui/verdict';

// ISR (not force-dynamic) so the CDN can cache it — a machine endpoint
// crawlers hit often shouldn't hit the origin every time. Data updates every
// 5 min; 60s staleness is invisible.
export const revalidate = 60;

// A single machine-readable snapshot of every app's current verdict, for
// search engines, AI assistants, and agents that want the whole board in one
// request (referenced from llms.txt). Verdicts mirror each provider's own
// official status page, read every five minutes.
export async function GET() {
  const apps = listCasualApps();
  const statuses = await Promise.all(
    apps.map(async (app) => {
      const status = await getCasualStatus({ appId: app.id }).catch(() => null);
      const verdict = status ? verdictKey(status.overall_status) : 'unknown';
      const label: Record<string, string> = { up: 'up', wobbly: 'degraded', down: 'down', unknown: 'unknown' };
      return {
        app: shortName(app.id, app.label),
        id: app.id,
        provider: app.providerDisplay,
        status: label[verdict] || 'unknown',
        summary: status?.headline || null,
        page: `https://aistatusdashboard.com/${app.id}`,
        official_status_page: status?.official_page?.url || null,
        official_reads: status?.official_page?.says || null,
        checked_at: status?.updated_at || null,
      };
    })
  );

  const anyDown = statuses.some((s) => s.status === 'down');
  const anyDegraded = statuses.some((s) => s.status === 'degraded');

  return NextResponse.json(
    {
      source: 'https://aistatusdashboard.com',
      description:
        "Live status of 26 consumer AI apps, mirroring each provider's own official status page (read every 5 minutes).",
      generated_at: new Date().toISOString(),
      overall: anyDown ? 'some_down' : anyDegraded ? 'some_degraded' : 'all_operational',
      count: statuses.length,
      apps: statuses,
      docs: 'https://aistatusdashboard.com/how-it-works',
      feed: 'https://aistatusdashboard.com/rss.xml',
    },
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // No manual Cache-Control: setting one alongside `export const
        // revalidate = 60` makes Next treat the handler as dynamic and emit
        // `no-store`. Let ISR own caching — it serves from a 60s server-side
        // cache, sparing the container regardless of what App Hosting stamps on
        // the client-facing header.
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
