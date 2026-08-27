'use client';

// Thin client-side event helper: forwards to GA4 (gtag). Events are anonymous
// (no PII in names or params); Consent Mode governs storage — without the
// banner opt-in GA keeps these cookieless, so we do NOT drop them here.
export function trackEvent(
  eventName: string,
  payload: { metadata?: Record<string, unknown> } = {}
) {
  try {
    const gtag = (window as any).gtag;
    if (typeof gtag !== 'function') return;
    gtag('event', eventName, payload.metadata || {});
  } catch {
    // Analytics must never break the page.
  }
}
