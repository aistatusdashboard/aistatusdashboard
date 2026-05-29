const LIVE_STATUS_EXACT_ROUTES = new Set([
  '/',
  '/providers',
  '/casual',
  '/incidents',
]);

const LIVE_STATUS_PREFIX_ROUTES = ['/casual/', '/incidents/', '/dashboard'];

export function normalizePathname(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  const raw = pathname.includes('://')
    ? (() => {
        try {
          return new URL(pathname).pathname;
        } catch {
          return pathname;
        }
      })()
    : pathname;
  const first = raw.split('?')[0]?.split('#')[0] || '/';
  if (!first.startsWith('/')) return `/${first}`;
  return first || '/';
}

export function shouldRenderLiveStatusStrip(pathname: string | null | undefined): boolean {
  const normalized = normalizePathname(pathname);
  if (LIVE_STATUS_EXACT_ROUTES.has(normalized)) return true;
  return LIVE_STATUS_PREFIX_ROUTES.some((prefix) => normalized.startsWith(prefix));
}

export function shouldRenderStatusPill(options: {
  status: string | null | undefined;
  lastUpdated: string | null | undefined;
  communityReports: number | null | undefined;
}): boolean {
  const status = (options.status || '').toLowerCase();
  if (!options.lastUpdated) return false;
  if (typeof options.communityReports !== 'number') return false;
  return status === 'operational' || status === 'degraded' || status === 'down' || status === 'maintenance';
}
