import { NextRequest, NextResponse } from 'next/server';
import { getEmbedStatus } from '@/lib/services/embed';

export const dynamic = 'force-dynamic';

function color(status: string) {
  if (status === 'down') return '#ef4444';
  if (status === 'degraded') return '#f59e0b';
  if (status === 'operational') return '#10b981';
  return '#64748b';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { provider: string } | Promise<{ provider: string }> }
) {
  const resolved = await Promise.resolve(params as { provider: string });
  const payload = await getEmbedStatus(resolved.provider);
  if (!payload) {
    return new NextResponse('/* provider not found */', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }
  const dotColor = color(payload.status);
  const script = `(function(){\n` +
    `var script=document.currentScript;if(!script){return;}\n` +
    `var a=document.createElement('a');a.href='${payload.casual_url}';a.target='_blank';a.rel='noopener noreferrer';\n` +
    `a.style.cssText='display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid #cbd5e1;background:#0f172a;color:#e2e8f0;font:12px/1.2 Inter,Segoe UI,sans-serif;text-decoration:none';\n` +
    `var dot=document.createElement('span');dot.style.cssText='width:8px;height:8px;border-radius:50%;display:inline-block;background:${dotColor};';\n` +
    `var text=document.createElement('span');text.textContent='${payload.provider}: ${payload.status}';\n` +
    `var brand=document.createElement('span');brand.style.cssText='opacity:.8';brand.textContent='powered by AIStatusDashboard';\n` +
    `a.appendChild(dot);a.appendChild(text);a.appendChild(brand);script.parentNode.insertBefore(a,script.nextSibling);\n` +
    `})();`;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=120',
    },
  });
}
