import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || request.headers.get('host');
  const proto = forwardedProto?.split(',')[0]?.trim();

  if (proto && host) return `${proto}://${host}`;
  if (host) return `${request.nextUrl.protocol}//${host}`;
  return request.nextUrl.origin;
}

function buildUrl(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const now = new Date().toISOString();

  const urls: string[] = [
    buildUrl(`${origin}/docs`, now, 'weekly', '0.7'),
    buildUrl(`${origin}/docs.md`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/docs/api`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/docs/api.md`, now, 'weekly', '0.5'),
    buildUrl(`${origin}/docs/agent/mcp-quickstart`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/docs/agent/mcp-quickstart.md`, now, 'weekly', '0.5'),
    buildUrl(`${origin}/docs/agent/mcp-tools`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/docs/agent/mcp-announcement`, now, 'weekly', '0.5'),
    buildUrl(`${origin}/docs/agent/gpt-actions.md`, now, 'weekly', '0.5'),
    buildUrl(`${origin}/docs/agent/bedrock-action-group.md`, now, 'weekly', '0.5'),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
