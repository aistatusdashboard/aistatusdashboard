import { NextResponse } from 'next/server';
import { getCasualApp, getCasualStatus } from '@/lib/services/casual';

export const dynamic = 'force-dynamic';

function titleFor(appId: string, fallback: string) {
  if (appId === 'chatgpt') return 'ChatGPT';
  if (appId === 'claude') return 'Claude';
  if (appId === 'gemini') return 'Gemini';
  return fallback.replace(' Status', '');
}

export async function GET(
  _request: Request,
  { params }: { params: { appId: string } | Promise<{ appId: string }> }
) {
  const resolved = await Promise.resolve(params as { appId: string });
  const app = getCasualApp(resolved.appId);
  if (!app) return new NextResponse('Not found', { status: 404 });
  const status = await getCasualStatus({ appId: app.id });
  if (!status) return new NextResponse('Not found', { status: 404 });
  const name = titleFor(app.id, app.label);
  const statusText =
    status.overall_status === 'down'
      ? 'is down'
      : status.overall_status === 'degraded'
        ? 'is partially affected'
        : 'is working normally';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <text x="72" y="180" font-family="Inter,Segoe UI,sans-serif" font-size="50" fill="#f8fafc">Is ${name} down right now?</text>
  <text x="72" y="260" font-family="Inter,Segoe UI,sans-serif" font-size="40" fill="#cbd5e1">${name} ${statusText}</text>
  <text x="72" y="330" font-family="Inter,Segoe UI,sans-serif" font-size="28" fill="#94a3b8">${status.headline}</text>
  <text x="72" y="390" font-family="Inter,Segoe UI,sans-serif" font-size="24" fill="#64748b">aistatusdashboard.com/casual/${app.id}</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
