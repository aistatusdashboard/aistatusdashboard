'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DarkModeToggle from './DarkModeToggle';
import Logo from './Logo';

type StatusTone = 'operational' | 'degraded' | 'down' | 'maintenance' | 'unknown';

type NavbarClientProps = {
  statusLabel: string;
  updatedAgo: string;
  reports: number | string;
  statusTone: StatusTone;
};

type NavItem = {
  label: string;
  href: string;
  dataTour?: string;
};

const navLinkClass =
  'flex items-center min-h-[40px] px-3 py-1.5 rounded-full whitespace-nowrap leading-none text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition';

const dropdownButtonClass =
  'flex items-center min-h-[40px] px-3 py-1.5 rounded-full whitespace-nowrap leading-none text-[13px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition';

const dropdownItemClass =
  'flex items-center min-h-[40px] px-3 py-2 rounded-xl whitespace-nowrap leading-none text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition';

const statusToneStyles: Record<StatusTone, { dot: string; text: string }> = {
  operational: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
  degraded: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
  down: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
  maintenance: { dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300' },
  unknown: { dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-300' },
};

function Dropdown({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div className="relative group">
      <button
        type="button"
        className={`${dropdownButtonClass} gap-1.5`}
        aria-haspopup="menu"
        aria-expanded="false"
      >
        {label}
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div
        className="absolute left-0 top-full mt-2 w-56 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 shadow-xl shadow-slate-900/10 backdrop-blur-md p-2 invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0 transition"
        role="menu"
      >
        {items.map((item) =>
          item.href.endsWith('.xml') || item.href.endsWith('.json') ? (
            <a
              key={item.label}
              href={item.href}
              className={dropdownItemClass}
              role="menuitem"
              data-tour={item.dataTour}
            >
              {item.label}
            </a>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              className={dropdownItemClass}
              role="menuitem"
              data-tour={item.dataTour}
            >
              {item.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

function StatusPill({
  statusLabel,
  updatedAgo,
  reports,
  statusTone,
}: {
  statusLabel: string;
  updatedAgo: string;
  reports: number | string;
  statusTone: StatusTone;
}) {
  const tone = statusToneStyles[statusTone];
  return (
    <div className="hidden min-[1400px]:flex items-center gap-2.5 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap leading-none min-h-[40px]">
      <span className={`h-2 w-2 rounded-full ${tone.dot} shrink-0`} aria-hidden="true" />
      <span className={`font-semibold ${tone.text}`}>{statusLabel}</span>
      <span aria-hidden="true">|</span>
      <span>Updated {updatedAgo}</span>
      <span aria-hidden="true">|</span>
      <span>Reports: {reports}</span>
    </div>
  );
}

export default function NavbarClient({ statusLabel, updatedAgo, reports, statusTone }: NavbarClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isDashboard = pathname?.startsWith('/dashboard');

  const primaryLinks: NavItem[] = [
    { label: 'Status', href: '/providers' },
    { label: 'ChatGPT', href: '/casual/chatgpt' },
    { label: 'Casual Mode', href: '/casual' },
  ];

  const developerLinks: NavItem[] = [
    { label: 'API', href: '/docs/api' },
    { label: 'OpenAPI', href: '/openapi.json' },
    { label: 'MCP', href: '/ai' },
    { label: 'RSS', href: '/rss.xml', dataTour: 'nav-rss' },
    { label: 'Datasets', href: '/datasets' },
    { label: 'Discovery audit', href: '/discovery/audit' },
  ];

  const moreLinks: NavItem[] = [
    { label: 'Notifications', href: '/dashboard?tab=notifications' },
    { label: 'Analytics', href: '/dashboard?tab=analytics' },
    { label: 'Reliability Lab', href: '/dashboard?tab=reliability' },
  ];

  return (
    <header className="sticky top-0 z-50" data-role="site-header">
      <div className="bg-white/90 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/70 shadow-[0_6px_24px_-18px_rgba(15,23,42,0.4)]">
        <div className="w-full px-3 sm:px-4 lg:px-6 min-h-[68px] flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <Logo />
            </div>
            <nav className="hidden xl:flex items-center gap-1.5" data-tour="nav">
              {primaryLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={navLinkClass}
                  data-tour={item.label === 'Casual Mode' ? 'nav-casual' : undefined}
                >
                  {item.label}
                </Link>
              ))}
              <Dropdown label="Developers" items={developerLinks} />
              {!isHome && isDashboard ? <Dropdown label="More" items={moreLinks} /> : null}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-3 ml-auto pl-3">
            <DarkModeToggle />
            <StatusPill
              statusLabel={statusLabel}
              updatedAgo={updatedAgo}
              reports={reports}
              statusTone={statusTone}
            />
            <Link
              href="/dashboard?tab=notifications"
              className="cta-primary text-xs px-4 py-2 min-h-[40px] whitespace-nowrap leading-none"
              data-tour="nav-alerts"
            >
              Get alerts
            </Link>
          </div>

          <div className="xl:hidden ml-auto flex items-center gap-2">
            <DarkModeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/40 z-40 xl:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-700/70 z-50 xl:hidden">
            <nav className="px-4 py-5 space-y-4 text-slate-700 dark:text-slate-200">
              <div className="space-y-2">
                {primaryLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block min-h-[40px] px-4 py-2 rounded-xl whitespace-nowrap leading-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                <p className="px-4 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                  Developers
                </p>
                {developerLinks.map((item) =>
                  item.href.endsWith('.xml') || item.href.endsWith('.json') ? (
                    <a
                      key={item.label}
                      href={item.href}
                      className="block min-h-[40px] px-4 py-2 rounded-xl whitespace-nowrap leading-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="block min-h-[40px] px-4 py-2 rounded-xl whitespace-nowrap leading-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </div>
              {!isHome && isDashboard ? (
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                  <p className="px-4 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                    More
                  </p>
                  {moreLinks.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="block min-h-[40px] px-4 py-2 rounded-xl whitespace-nowrap leading-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
              <Link
                href="/dashboard?tab=notifications"
                className="block min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 text-white text-base font-semibold text-center whitespace-nowrap leading-none"
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
