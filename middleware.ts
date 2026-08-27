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

export function middleware(request: NextRequest) {
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
