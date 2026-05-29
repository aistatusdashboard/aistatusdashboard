import { NextRequest, NextResponse } from 'next/server';
import { getEmbedStatus } from '@/lib/services/embed';

export const dynamic = 'force-dynamic';

function tone(status: string) {
  if (status === 'down') return { color: '#ef4444', label: 'Down' };
  if (status === 'degraded') return { color: '#f59e0b', label: 'Degraded' };
  if (status === 'operational') return { color: '#10b981', label: 'Operational' };
  return { color: '#64748b', label: 'Unknown' };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { provider: string } | Promise<{ provider: string }> }
) {
  const resolved = await Promise.resolve(params as { provider: string });
  const payload = await getEmbedStatus(resolved.provider);
  if (!payload) {
    return new NextResponse('Not found', { status: 404 });
  }

  const state = tone(payload.status);
  const label = `${payload.provider}: ${state.label}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="32" role="img" aria-label="${label}">
  <rect width="380" height="32" rx="8" fill="#0f172a"/>
  <circle cx="18" cy="16" r="6" fill="${state.color}"/>
  <text x="34" y="20" font-family="Inter,Segoe UI,sans-serif" font-size="12" fill="#e2e8f0">${payload.provider}</text>
  <text x="198" y="20" font-family="Inter,Segoe UI,sans-serif" font-size="12" fill="#ffffff">${state.label}</text>
  <a href="${payload.casual_url}">
    <text x="250" y="20" font-family="Inter,Segoe UI,sans-serif" font-size="11" fill="#93c5fd">powered by AIStatusDashboard</text>
  </a>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=120',
    },
  });
}
