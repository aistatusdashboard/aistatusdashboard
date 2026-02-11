'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
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

function applyGaConsent(measurementId: string, decision: CookieConsentDecision | null) {
  if (typeof window === 'undefined') return false;

  const analyticsEnabled = decision === 'accepted';
  (window as any)[`ga-disable-${measurementId}`] = !analyticsEnabled;

  if (window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: analyticsEnabled ? 'granted' : 'denied',
    });
  }

  return analyticsEnabled;
}

export default function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const updateFromDecision = (decision: CookieConsentDecision | null) => {
      setEnabled(applyGaConsent(measurementId, decision));
    };

    updateFromDecision(getCookieConsentDecision());

    const handleConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ decision?: CookieConsentDecision }>).detail;
      updateFromDecision(detail?.decision || getCookieConsentDecision());
    };

    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleConsentUpdated as EventListener);
    return () => {
      window.removeEventListener(
        COOKIE_CONSENT_UPDATED_EVENT,
        handleConsentUpdated as EventListener
      );
    };
  }, [measurementId]);

  if (!measurementId || !enabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('consent', 'default', { analytics_storage: 'granted' });
          gtag('config', '${measurementId}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  );
}
