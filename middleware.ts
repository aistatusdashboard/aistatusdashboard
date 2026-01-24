import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_CANONICAL_HOST = 'aistatusdashboard.com';
const DISCOVERY_EXTENSIONS = ['.xml', '.yaml', '.md', '.ndjson', '.csv'];
const DISCOVERY_BUILD_ID =
  process.env.APP_BUILD_ID || process.env.GITHUB_SHA || process.env.COMMIT_SHA || 'unknown';
const DISCOVERY_PROXY_ORIGIN =
  process.env.DISCOVERY_PROXY_ORIGIN ||
  'https://raw.githubusercontent.com/aistatusdashboard/aistatusdashboard/main/public';

function shouldBypassCache(request: NextRequest): boolean {
  const accept = request.headers.get('accept') || '';
  const fetchDest = request.headers.get('sec-fetch-dest') || '';
  return accept.includes('text/html') || fetchDest === 'document';
}

function getCanonicalHost(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;

  try {
    return new URL(siteUrl).host;
  } catch {
    return DEFAULT_CANONICAL_HOST;
  }
}

function isDiscoveryAsset(pathname: string): boolean {
  if (pathname === '/robots.txt') return true;
  if (pathname === '/rss.xml' || pathname === '/sitemap.xml') return true;
  if (pathname === '/llms.txt' || pathname === '/llms-full.txt') return true;
  if (pathname === '/openapi.json' || pathname === '/openapi-3.0.json') return true;
  if (pathname.startsWith('/datasets/')) return true;
  if (pathname.startsWith('/discovery/audit')) return true;
  if (pathname.startsWith('/docs/') && pathname.endsWith('.md')) return true;
  if (pathname === '/docs.md' || pathname === '/status.md' || pathname === '/providers.md') return true;
  if (pathname === '/openapi.yaml' || pathname === '/openapi-3.0.yaml') return true;
  return DISCOVERY_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function isPublicIndexable(pathname: string): boolean {
  if (isDiscoveryAsset(pathname)) return true;
  if (pathname === '/ai' || pathname === '/providers' || pathname === '/datasets') return true;
  if (pathname.startsWith('/provider/')) return true;
  if (pathname.startsWith('/incidents')) return true;
  if (pathname.startsWith('/status')) return true;
  return false;
}

function getProxyPath(pathname: string): string {
  if (pathname === '/discovery/audit') return '/discovery/audit/index.html';
  if (pathname === '/discovery/audit/') return '/discovery/audit/index.html';
  return pathname;
}

function applyDiscoveryHeaders(response: NextResponse, pathname: string) {
  response.headers.set('X-Robots-Tag', 'index,follow');
  response.headers.set('X-Discovery-Handler', 'static');
  response.headers.set('X-Discovery-Build', DISCOVERY_BUILD_ID);
  response.headers.set('X-Discovery-Runtime', 'static');

  if (pathname === '/rss.xml') {
    response.headers.set('Content-Type', 'application/rss+xml; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    return;
  }

  if (pathname === '/sitemap.xml') {
    response.headers.set('Content-Type', 'application/xml; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return;
  }

  if (pathname === '/robots.txt') {
    response.headers.set('Content-Type', 'text/plain; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return;
  }

  if (pathname.endsWith('.yaml')) {
    response.headers.set('Content-Type', 'application/yaml; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=1200');
    return;
  }

  if (pathname.endsWith('.md')) {
    response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return;
  }

  if (pathname.endsWith('.ndjson')) {
    response.headers.set('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    return;
  }

  if (pathname.endsWith('.csv')) {
    response.headers.set('Content-Type', 'text/csv; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    return;
  }

  if (pathname === '/llms.txt' || pathname === '/llms-full.txt') {
    response.headers.set('Content-Type', 'text/plain; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return;
  }

  if (pathname === '/openapi.json' || pathname === '/openapi-3.0.json') {
    response.headers.set('Content-Type', 'application/json; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=1200');
    return;
  }

  if (pathname === '/discovery/audit/latest.json') {
    response.headers.set('Content-Type', 'application/json; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    return;
  }

  if (pathname === '/discovery/audit') {
    response.headers.set('Content-Type', 'text/html; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const canonicalHost = getCanonicalHost();
  const currentHost = request.headers.get('host');
  const currentHostname = currentHost ? currentHost.split(':')[0] : null;

  if (process.env.NODE_ENV === 'production' && canonicalHost && currentHostname) {
    const wwwHost = `www.${canonicalHost}`;
    if (currentHostname === wwwHost) {
      const url = request.nextUrl.clone();
      url.hostname = canonicalHost;
      url.port = '';
      url.protocol = 'https:';
      return NextResponse.redirect(url, 308);
    }
  }

  if (isDiscoveryAsset(pathname)) {
    try {
      const proxyPath = getProxyPath(pathname);
      const proxyUrl = `${DISCOVERY_PROXY_ORIGIN}${proxyPath}`;
      const upstream = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'aistatusdashboard-discovery-proxy',
        },
      });
      if (upstream.ok) {
        const body = await upstream.arrayBuffer();
        const response = new NextResponse(body, { status: 200 });
        applyDiscoveryHeaders(response, pathname);
        response.headers.set('X-Discovery-Source', 'proxy');
        return response;
      }
    } catch {
      // fall through to origin
    }

    const response = NextResponse.next();
    applyDiscoveryHeaders(response, pathname);
    return response;
  }

  // PERFORMANCE: only short-circuit HEAD requests that are clearly HTML page fetches.
  if (request.method === 'HEAD') {
    const accept = request.headers.get('accept') || '';
    const fetchDest = request.headers.get('sec-fetch-dest') || '';
    const isHtmlIntent = accept.includes('text/html') || fetchDest === 'document';
    if (isHtmlIntent) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'X-Response-Time': '1ms',
          'X-Optimized': 'head-request',
        },
      });
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  const privatePrefixes = ['/app', '/account', '/org', '/billing', '/api/private'];
  const isPrivate = privatePrefixes.some((prefix) => pathname.startsWith(prefix));
  if (isPrivate) {
    response.headers.set('X-Robots-Tag', 'noindex,nofollow');
  } else if (isPublicIndexable(pathname)) {
    response.headers.set('X-Robots-Tag', 'index,follow');
  }

  if (request.method === 'GET' && shouldBypassCache(request)) {
    // Keep HTML uncached so deploys never serve stale shells with missing JS chunks.
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    const existingVary = response.headers.get('Vary');
    response.headers.set('Vary', existingVary ? `${existingVary}, Accept` : 'Accept');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|rss.xml|llms.txt|llms-full.txt|openapi.json|openapi-3.0.json|openapi.yaml|openapi-3.0.yaml|docs.md|status.md|providers.md|discovery/|datasets/|.*\\.md$|.*\\.csv$|.*\\.ndjson$|.*\\.yaml$|.*\\.xml$|.*\\.txt$).*)',
    '/api/private/:path*',
  ],
};
