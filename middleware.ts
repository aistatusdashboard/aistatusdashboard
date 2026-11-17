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

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
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

// On Firebase App Hosting a route matched by middleware is never CDN-cached
// ("Routes affected by Next.js middleware aren't cached"). That is exactly what
// the live pages need: the site's whole purpose is "is it down right now", and
// efd3baf (2026-09-08) records the decision not to buy savings with staleness.
// So the matcher covers every page, and deliberately leaves out only the things
// whose age does not matter and whose volume does:
// - /api/public/v1/status and /api/public/v1/incidents: removed API paths one
//   bot still calls ~52k times a day; route handlers answer 410 with a public
//   Cache-Control so the CDN absorbs them (see lib/utils/gone-api.ts).
// - /og/*: share images, which crawlers fetch with short timeouts.
// Do not widen these exclusions to pages that show a live verdict.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/public/v1/status|api/public/v1/incidents|og/).*)'],
};
