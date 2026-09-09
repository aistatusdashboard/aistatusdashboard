import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_CANONICAL_HOST = 'aistatusdashboard.com';

function getCanonicalHost(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;

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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
