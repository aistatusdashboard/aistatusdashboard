'use client';

import { useEffect } from 'react';
import {
  COOKIE_CONSENT_UPDATED_EVENT,
  type CookieConsentDecision,
  getCookieConsentDecision,
} from '@/lib/utils/cookie-consent';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

// The gtag bootstrap lives in the root layout's <head> so it is part of the
// initial HTML and always executes (dynamically mounted inline scripts do
// not). This component only keeps GA's consent state in sync with the banner.
function applyGaConsent(decision: CookieConsentDecision | null) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('consent', 'update', {
    analytics_storage: decision === 'accepted' ? 'granted' : 'denied',
  });
}

export default function GoogleAnalytics(_props: { measurementId?: string }) {
  useEffect(() => {
    applyGaConsent(getCookieConsentDecision());

    // Conversion: the email-confirm endpoint redirects to /?confirmed=true|false.
    try {
      const confirmed = new URLSearchParams(window.location.search).get('confirmed');
      if (confirmed !== null && window.gtag) {
        window.gtag('event', 'alert_confirmed', { success: confirmed === 'true' });
      }
    } catch {
      /* never break the page */
    }

    const handleConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ decision?: CookieConsentDecision }>).detail;
      applyGaConsent(detail?.decision || getCookieConsentDecision());
    };

    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleConsentUpdated as EventListener);
    return () => {
      window.removeEventListener(
        COOKIE_CONSENT_UPDATED_EVENT,
        handleConsentUpdated as EventListener
      );
    };
  }, []);

  return null;
}
