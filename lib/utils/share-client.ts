// Client-side sharing: prefers the OS share sheet (phones + some desktops),
// falls back to copying the link. Every shared URL is UTM-tagged so GA can
// attribute visits that arrive via a shared link (utm_campaign=app_share).
import { trackEvent } from '@/lib/utils/analytics-client';

const BASE = 'https://aistatusdashboard.com';

export function buildShareUrl(path: string, where: string): string {
  const url = new URL(path.startsWith('http') ? path : `${BASE}${path}`);
  url.searchParams.set('utm_source', 'aistatusdashboard');
  url.searchParams.set('utm_medium', 'share');
  url.searchParams.set('utm_campaign', 'app_share');
  url.searchParams.set('utm_content', where);
  return url.toString();
}

function deviceKind(): 'phone' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'phone' : 'desktop';
}

export function canWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
}

type ShareResult = 'web_share' | 'copy_link' | 'dismissed' | 'error';

// Try the native share sheet first; fall back to copying the link. Browsers
// often ignore `title`, so the message goes in `text`. A closed share sheet
// (AbortError) is a no-op, not a failure.
export async function shareOrCopy(opts: { text: string; path: string; where: string }): Promise<ShareResult> {
  const url = buildShareUrl(opts.path, opts.where);
  const device = deviceKind();
  if (canWebShare()) {
    try {
      await (navigator as any).share({ text: opts.text, url });
      trackEvent('share_success', { metadata: { method: 'web_share', where: opts.where, device } });
      return 'web_share';
    } catch (e: any) {
      if (e && e.name === 'AbortError') {
        trackEvent('share_dismissed', { metadata: { where: opts.where, device } });
        return 'dismissed';
      }
      // fall through to copy
    }
  }
  return copyLink(opts.path, opts.where);
}

export async function copyLink(path: string, where: string): Promise<ShareResult> {
  const url = buildShareUrl(path, where);
  const device = deviceKind();
  try {
    await navigator.clipboard.writeText(url);
    trackEvent('share_success', { metadata: { method: 'copy_link', where, device } });
    return 'copy_link';
  } catch {
    trackEvent('share_failure', { metadata: { where, device } });
    return 'error';
  }
}
