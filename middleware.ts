import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import appsConfig from '@/lib/casual/apps.json';

// Single-segment app slugs, lowercased, for the case-normalizing redirect.
const APP_SLUGS = new Set(
  (appsConfig.apps as Array<{ id: string }>).map((a) => a.id.toLowerCase())
);

const DEFAULT_CANONICAL_HOST = 'aistatusdashboard.com';

// Fall back to the hardcoded apex host: NEXT_PUBLIC_SITE_URL is a build-time
// inline for the client bundle and isn't guaranteed to be in the middleware's
// runtime env, so relying on it here silently disabled the www->apex redirect.
function getCanonicalHost(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return DEFAULT_CANONICAL_HOST;

  try {
    return new URL(siteUrl).host;
  } catch {
    return DEFAULT_CANONICAL_HOST;
  }
}

// Two API paths that were never implemented here take ~50k requests a day
// (`/api/public/v1/status/summary`, `/api/public/v1/incidents`). Falling
// through to Next's 404 rendered a ~20KB HTML page marked no-store, so every
// one of them woke the container and none were ever cached. 410 rather than
// 404 is deliberate: a crawler retries a 404 indefinitely but drops a 410,
// which is the only thing that actually stops the flood at its source. The
// live public API lives under /api/public/v1/casual/.
const GONE_API_PREFIXES = [
  '/api/public/v1/status',
  '/api/public/v1/incidents',
];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (GONE_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return NextResponse.json(
      { error: 'Gone', hint: 'The public API lives under /api/public/v1/casual/.' },
      {
        status: 410,
        headers: { 'Cache-Control': 'public, max-age=86400' },
      }
    );
  }

  const canonicalHost = getCanonicalHost();
  // Behind App Hosting / Google Frontend the `host` header is the internal
  // Cloud Run host, not the domain the visitor typed — the real one arrives in
  // `x-forwarded-host`. Reading `host` alone is why www was never redirected.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const rawHost = forwardedHost?.split(',')[0]?.trim() || request.headers.get('host');
  const currentHostname = rawHost ? rawHost.split(':')[0] : null;

  // Redirect www -> apex in a single 308. No NODE_ENV guard: a www host is
  // never correct to serve directly, and localhost can't match this anyway.
  if (currentHostname && currentHostname === `www.${canonicalHost}`) {
    const url = request.nextUrl.clone();
    url.hostname = canonicalHost;
    url.port = '';
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  // Case-normalize app pages (/ChatGPT -> /chatgpt) in one clean 308 so an
  // uppercase variant isn't a duplicate 200. Only single-segment app slugs —
  // incident ids and other paths keep their case.
  if (/^\/[^/]+$/.test(path) && path !== path.toLowerCase() && APP_SLUGS.has(path.slice(1).toLowerCase())) {
    const url = request.nextUrl.clone();
    url.pathname = path.toLowerCase();
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
