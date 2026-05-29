import { NextRequest, NextResponse } from 'next/server';
import { getEmbedStatus } from '@/lib/services/embed';

export const dynamic = 'force-dynamic';

function tone(status: string) {
  if (status === 'down') return { color: '#ef4444', label: 'Down' };
  if (status === 'degraded') return { color: '#f59e0b', label: 'Degraded' };
  if (status === 'operational') return { color: '#10b981', label: 'Operational' };
  return { color: '#64748b', label: 'Unknown' };
}

function parseAsset(asset: string): { provider: string; format: 'svg' | 'js' | 'json' } | null {
  const idx = asset.lastIndexOf('.');
  if (idx <= 0) return null;
  const provider = asset.slice(0, idx);
  const ext = asset.slice(idx + 1).toLowerCase();
  if (!provider) return null;
  if (ext === 'svg' || ext === 'js' || ext === 'json') {
    return { provider, format: ext };
  }
  return null;
}

function toJavascript(payload: {
  provider: string;
  status: string;
  casual_url: string;
}) {
  const dot = tone(payload.status).color;
  return `(function(){\n` +
    `var script=document.currentScript;if(!script){return;}\n` +
    `var a=document.createElement('a');a.href='${payload.casual_url}';a.target='_blank';a.rel='noopener noreferrer';\n` +
    `a.style.cssText='display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid #cbd5e1;background:#0f172a;color:#e2e8f0;font:12px/1.2 Inter,Segoe UI,sans-serif;text-decoration:none';\n` +
    `var dot=document.createElement('span');dot.style.cssText='width:8px;height:8px;border-radius:50%;display:inline-block;background:${dot};';\n` +
    `var text=document.createElement('span');text.textContent='${payload.provider}: ${payload.status}';\n` +
    `var brand=document.createElement('span');brand.style.cssText='opacity:.8';brand.textContent='powered by AIStatusDashboard';\n` +
    `a.appendChild(dot);a.appendChild(text);a.appendChild(brand);script.parentNode.insertBefore(a,script.nextSibling);\n` +
    `})();`;
}

function toSvg(payload: {
  provider: string;
  status: string;
  casual_url: string;
}) {
  const state = tone(payload.status);
  const label = `${payload.provider}: ${state.label}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="32" role="img" aria-label="${label}">
  <rect width="380" height="32" rx="8" fill="#0f172a"/>
  <circle cx="18" cy="16" r="6" fill="${state.color}"/>
  <text x="34" y="20" font-family="Inter,Segoe UI,sans-serif" font-size="12" fill="#e2e8f0">${payload.provider}</text>
  <text x="198" y="20" font-family="Inter,Segoe UI,sans-serif" font-size="12" fill="#ffffff">${state.label}</text>
  <a href="${payload.casual_url}">
    <text x="250" y="20" font-family="Inter,Segoe UI,sans-serif" font-size="11" fill="#93c5fd">powered by AIStatusDashboard</text>
  </a>
</svg>`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { asset: string } | Promise<{ asset: string }> }
) {
  const resolved = await Promise.resolve(params as { asset: string });
  const parsed = parseAsset(resolved.asset);
  if (!parsed) {
    return new NextResponse('Not found', { status: 404 });
  }

  const payload = await getEmbedStatus(parsed.provider);
  if (!payload) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (parsed.format === 'json') {
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
    });
  }

  if (parsed.format === 'js') {
    return new NextResponse(toJavascript(payload), {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  }

  return new NextResponse(toSvg(payload), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=120',
    },
  });
}
