'use client';

import Link from 'next/link';
import { openCookieConsentPreferences } from '@/lib/utils/cookie-consent';

export default function Footer() {
  return (
    <footer role="contentinfo" className="border-t border-slate-200/70 dark:border-slate-800/70 mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-4 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Independent status checks for the AI apps you use — tested by us, every few minutes.
        </p>
        <div className="text-xs text-slate-500 dark:text-slate-400 space-x-1">
          <Link href="/about" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            About
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            How it works
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/incidents" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Outage history
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/reliability" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Reliability ranking
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Terms
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={openCookieConsentPreferences}
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Cookie preferences
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Not affiliated with any AI provider. Verify critical decisions against official sources.
        </p>
      </div>
    </footer>
  );
}
