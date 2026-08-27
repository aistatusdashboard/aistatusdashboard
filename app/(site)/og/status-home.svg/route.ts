import { NextResponse } from 'next/server';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pulse = await getLivePulseSnapshot();
  const label =
    pulse.status === 'down'
      ? 'Some AI apps are down right now'
      : pulse.status === 'degraded'
        ? 'Some AI apps are having issues'
        : 'ChatGPT, Claude, Gemini and more — all checked live';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#0f172a"/>
  <text x="72" y="190" font-family="Inter,Segoe UI,sans-serif" font-size="54" fill="#f8fafc">Is your AI down right now?</text>
  <text x="72" y="270" font-family="Inter,Segoe UI,sans-serif" font-size="40" fill="#cbd5e1">${label}</text>
  <text x="72" y="340" font-family="Inter,Segoe UI,sans-serif" font-size="30" fill="#94a3b8">Independently tested every few minutes · aistatusdashboard.com</text>
</svg>`;
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
