'use client';

import { hasCookieConsent } from '@/lib/utils/cookie-consent';

// Thin client-side event helper: forwards to GA4 (gtag) when it is available
// and the visitor has consented. No first-party analytics backend.
export function trackEvent(
  eventName: string,
  payload: { metadata?: Record<string, unknown> } = {}
) {
  try {
    if (!hasCookieConsent()) return;
    const gtag = (window as any).gtag;
    if (typeof gtag !== 'function') return;
    gtag('event', eventName, payload.metadata || {});
  } catch {
    // Analytics must never break the page.
  }
}
