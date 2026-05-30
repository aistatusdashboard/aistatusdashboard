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

function escapeXml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toJavascript(payload: {
  provider: string;
  status: string;
  casual_url: string;
}) {
  const dot = tone(payload.status).color;
  const label = tone(payload.status).label;
  return `(function(){\n` +
    `var script=document.currentScript;if(!script){return;}\n` +
    `var a=document.createElement('a');a.href='${payload.casual_url}';a.target='_blank';a.rel='noopener noreferrer';\n` +
    `a.style.cssText='display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid #cbd5e1;background:#0f172a;color:#e2e8f0;font:12px/1.2 Inter,Segoe UI,sans-serif;text-decoration:none;white-space:nowrap;max-width:100%;width:max-content';\n` +
    `var dot=document.createElement('span');dot.style.cssText='width:8px;height:8px;border-radius:50%;display:inline-block;background:${dot};';\n` +
    `var text=document.createElement('span');text.textContent='${payload.provider}: ${label}';\n` +
    `var brand=document.createElement('span');brand.style.cssText='opacity:.8';brand.textContent='powered by AI Status Dashboard';\n` +
    `a.appendChild(dot);a.appendChild(text);a.appendChild(brand);script.parentNode.insertBefore(a,script.nextSibling);\n` +
    `})();`;
}

function toSvg(payload: {
  provider: string;
  status: string;
  casual_url: string;
}) {
  const state = tone(payload.status);
  const statusLabel = `${payload.provider}: ${state.label}`;
  const brandLabel = 'powered by AI Status Dashboard';
  const contentWidth = Math.max(
    360,
    Math.ceil(payload.provider.length * 7.2) + Math.ceil(state.label.length * 7.2) + Math.ceil(brandLabel.length * 6.4) + 120
  );
  const providerTextX = 34;
  const stateTextX = Math.max(providerTextX + payload.provider.length * 7.2 + 24, 170);
  const brandTextX = Math.max(stateTextX + state.label.length * 7.2 + 20, 245);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${contentWidth}" height="32" viewBox="0 0 ${contentWidth} 32" role="img" aria-label="${escapeXml(statusLabel)}">
  <rect width="${contentWidth}" height="32" rx="8" fill="#0f172a"/>
  <circle cx="18" cy="16" r="6" fill="${state.color}"/>
  <text x="${providerTextX}" y="20" font-family="Inter,Segoe UI,sans-serif" font-size="12" fill="#e2e8f0">${escapeXml(payload.provider)}</text>
  <text x="${stateTextX}" y="20" font-family="Inter,Segoe UI,sans-serif" font-size="12" fill="#ffffff">${escapeXml(state.label)}</text>
  <a href="${payload.casual_url}">
    <text x="${brandTextX}" y="20" font-family="Inter,Segoe UI,sans-serif" font-size="11" fill="#93c5fd">${brandLabel}</text>
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
