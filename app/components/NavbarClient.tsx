'use client';

import { useState } from 'react';
import Link from 'next/link';
import DarkModeToggle from './DarkModeToggle';
import Logo from './Logo';

type StatusTone = 'operational' | 'degraded' | 'down' | 'maintenance' | 'unknown';

type NavbarClientProps = {
  statusLabel: string | null;
  updatedAgo: string | null;
  reports: number | null;
  statusTone: StatusTone;
};

type NavItem = {
  label: string;
  href: string;
};

const navLinkClass =
  'flex items-center min-h-[40px] px-3 py-1.5 rounded-full whitespace-nowrap leading-none text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition';

const statusToneStyles: Record<StatusTone, { dot: string; text: string }> = {
  operational: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  degraded: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
  down: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
  maintenance: { dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300' },
  unknown: { dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-300' },
};

const NAV_LINKS: NavItem[] = [
  { label: 'ChatGPT', href: '/chatgpt' },
  { label: 'Claude', href: '/claude' },
  { label: 'Gemini', href: '/gemini' },
  { label: 'Reliability', href: '/reliability' },
  { label: 'Outage history', href: '/incidents' },
  { label: 'How it works', href: '/how-it-works' },
];

function StatusPill({
  statusLabel,
  updatedAgo,
  statusTone,
}: {
  statusLabel: string;
  updatedAgo: string;
  statusTone: StatusTone;
}) {
  const tone = statusToneStyles[statusTone];
  return (
    <div className="hidden lg:flex items-center gap-2.5 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 px-3 py-1.5 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap leading-none min-h-[40px]">
      <span className={`h-2 w-2 rounded-full ${tone.dot} shrink-0 animate-pulse`} aria-hidden="true" />
      <span className={`font-semibold ${tone.text}`}>{statusLabel}</span>
      <span aria-hidden="true">·</span>
      <span>{updatedAgo}</span>
    </div>
  );
}

export default function NavbarClient({ statusLabel, updatedAgo, statusTone }: NavbarClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showStatusPill = Boolean(statusLabel && updatedAgo);

  return (
    <header className="sticky top-0 z-50" data-role="site-header">
      <div className="bg-white/90 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/70">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 min-h-[64px] flex items-center gap-4">
          <div className="shrink-0">
            <Logo />
          </div>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {NAV_LINKS.map((item) => (
              <Link key={item.label} href={item.href} className={navLinkClass}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3 ml-auto">
            {showStatusPill ? (
              <StatusPill
                statusLabel={statusLabel as string}
                updatedAgo={updatedAgo as string}
                statusTone={statusTone}
              />
            ) : null}
            <DarkModeToggle />
            <Link
              href="/#alerts"
              className="cta-primary text-sm font-semibold px-4 py-2 min-h-[40px] whitespace-nowrap leading-none"
            >
              Get alerts
            </Link>
          </div>

          <div className="md:hidden ml-auto flex items-center gap-2">
            <DarkModeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-700/70 z-50 md:hidden">
            <nav className="px-4 py-5 space-y-2 text-slate-700 dark:text-slate-200" aria-label="Main mobile">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block min-h-[40px] px-4 py-2 rounded-xl whitespace-nowrap leading-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base font-semibold text-slate-800 dark:text-slate-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/#alerts"
                className="block min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-semibold text-center whitespace-nowrap leading-none"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get alerts
              </Link>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
