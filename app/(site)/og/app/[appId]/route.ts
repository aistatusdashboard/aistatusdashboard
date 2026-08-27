import { NextResponse } from 'next/server';
import { getCasualApp, getCasualStatus } from '@/lib/services/casual';
import { shortName } from '@/lib/ui/verdict';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { appId: string } | Promise<{ appId: string }> }
) {
  const resolved = await Promise.resolve(params as { appId: string });
  // Tolerate an optional .svg suffix so old links keep working.
  const appId = resolved.appId.replace(/\.svg$/i, '');
  const app = getCasualApp(appId);
  if (!app) return new NextResponse('Not found', { status: 404 });
  const status = await getCasualStatus({ appId: app.id }).catch(() => null);
  const name = shortName(app.id, app.label);
  const statusText = !status
    ? 'status check in progress'
    : status.overall_status === 'down'
      ? 'looks down right now'
      : status.overall_status === 'degraded'
        ? 'is having issues'
        : 'is up';
  const color =
    status?.overall_status === 'down'
      ? '#fb7185'
      : status?.overall_status === 'degraded'
        ? '#fbbf24'
        : '#34d399';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <text x="72" y="170" font-family="Inter,Segoe UI,sans-serif" font-size="46" fill="#94a3b8">Is ${name} down right now?</text>
  <text x="72" y="280" font-family="Inter,Segoe UI,sans-serif" font-size="64" font-weight="700" fill="${color}">${name} ${statusText}</text>
  <text x="72" y="380" font-family="Inter,Segoe UI,sans-serif" font-size="28" fill="#64748b">Independently tested every few minutes · aistatusdashboard.com/${app.id}</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
