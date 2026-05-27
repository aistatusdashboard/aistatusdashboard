'use client';

import Link from 'next/link';
import { openCookieConsentPreferences } from '@/lib/utils/cookie-consent';
import { footerProjectsFor } from '@/lib/cross-project';

const REPORT_SCORE = 95;
const REPORT_URL = 'https://agentability.org/reports/aistatusdashboard.com';
const FOOTER_DESCRIPTOR =
  'benchmark · MCP search · DNS delegation · agent-readiness audit · tool control plane';

export default function Footer() {
  const siblings = footerProjectsFor('aistatusdashboard');

  return (
    <footer role="contentinfo" className="border-t border-slate-200/70 dark:border-slate-800/70 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            For reference only. Verify critical production decisions against official provider sources.
          </p>
        </div>

        <div className="text-center text-sm text-slate-600 dark:text-slate-300">
          <a
            href={REPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Audited by Agentability — score {REPORT_SCORE}/100 (full report →)
          </a>
        </div>

        <div className="text-center text-xs text-slate-500 dark:text-slate-400">
          <Link href="/stats" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Stats
          </Link>
          {' | '}
          <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Terms
          </Link>
          {' | '}
          <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            Privacy
          </Link>
          {' | '}
          <button
            type="button"
            onClick={openCookieConsentPreferences}
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Cookie preferences
          </button>
        </div>

        <div
          data-cross-project-footer
          className="text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/70 dark:border-slate-800/70 pt-4"
        >
          Cross-project:{' '}
          {siblings.map((sibling, index) => (
            <span key={sibling.key}>
              <a
                href={sibling.statsUrl}
                className="text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white underline"
              >
                {sibling.name}
              </a>
              {index < siblings.length - 1 ? ' · ' : ' '}
            </span>
          ))}
          — {FOOTER_DESCRIPTOR}
        </div>
      </div>
    </footer>
  );
}
