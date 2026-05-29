import { NextResponse } from 'next/server';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pulse = await getLivePulseSnapshot();
  const label =
    pulse.status === 'down'
      ? 'Some providers are down'
      : pulse.status === 'degraded'
        ? 'Some providers are degraded'
        : 'ChatGPT, Claude, and Gemini status at a glance';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <text x="72" y="190" font-family="Inter,Segoe UI,sans-serif" font-size="54" fill="#f8fafc">AI Status</text>
  <text x="72" y="270" font-family="Inter,Segoe UI,sans-serif" font-size="44" fill="#cbd5e1">${label}</text>
  <text x="72" y="340" font-family="Inter,Segoe UI,sans-serif" font-size="30" fill="#94a3b8">Updated every 60s · aistatusdashboard.com</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
