'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  COOKIE_CONSENT_OPEN_EVENT,
  COOKIE_CONSENT_UPDATED_EVENT,
  type CookieConsentDecision,
  getCookieConsentDecision,
  setCookieConsentDecision,
} from '@/lib/utils/cookie-consent';

export default function CookieConsentBanner() {
  const [decision, setDecision] = useState<CookieConsentDecision | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existingDecision = getCookieConsentDecision();
    setDecision(existingDecision);
    setVisible(!existingDecision);
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setDecision(getCookieConsentDecision());
      setVisible(true);
    };

    const handleConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ decision?: CookieConsentDecision }>).detail;
      if (!detail?.decision) return;
      setDecision(detail.decision);
      setVisible(false);
    };

    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen as EventListener);
    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleConsentUpdated as EventListener);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, handleOpen as EventListener);
      window.removeEventListener(
        COOKIE_CONSENT_UPDATED_EVENT,
        handleConsentUpdated as EventListener
      );
    };
  }, []);

  const applyDecision = (nextDecision: CookieConsentDecision) => {
    setCookieConsentDecision(nextDecision);
  };

  if (!visible) return null;

  return (
    <section
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur shadow-[0_-16px_48px_-30px_rgba(15,23,42,0.7)]"
      role="dialog"
      aria-label="Privacy and cookies"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Privacy and cookies</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            We use essential storage for core features. With your permission, we also use analytics
            and telemetry cookies/storage to improve reliability insights.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Review our{' '}
            <Link href="/privacy#cookies" className="underline hover:text-slate-900 dark:hover:text-white">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="underline hover:text-slate-900 dark:hover:text-white">
              Terms
            </Link>
            .
          </p>
          {decision && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Current preference: {decision === 'accepted' ? 'analytics allowed' : 'analytics declined'}.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {decision && (
            <button
              type="button"
              onClick={() => setVisible(false)}
              className="px-4 py-2 rounded-full text-sm font-medium border border-slate-300/80 dark:border-slate-600/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white min-h-[44px]"
            >
              Close
            </button>
          )}
          <button
            type="button"
            onClick={() => applyDecision('rejected')}
            className="px-4 py-2 rounded-full text-sm font-medium border border-slate-300/80 dark:border-slate-600/80 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white min-h-[44px]"
          >
            Reject optional
          </button>
          <button
            type="button"
            onClick={() => applyDecision('accepted')}
            className="px-4 py-2 rounded-full text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 min-h-[44px]"
          >
            Accept all
          </button>
        </div>
      </div>
    </section>
  );
}
