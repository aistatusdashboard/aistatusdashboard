'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import DarkModeToggle from './DarkModeToggle';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isLanding = pathname === '/';

  if (isLanding) {
    return (
      <header className="absolute top-0 left-0 right-0 z-50 landing-header">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="h-10 w-10 rounded-2xl bg-white/95 dark:bg-slate-50 text-slate-900 flex items-center justify-center border border-slate-200/70 dark:border-slate-700/60 shadow-lg shadow-slate-900/10 dark:shadow-black/30">
              <Image
                src="/brand/logo-mark.png"
                alt="AI Status Dashboard Logo"
                width={28}
                height={28}
                className="rounded-lg drop-shadow-sm dark:brightness-110"
                priority
              />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">AI Status Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <DarkModeToggle />
            <Link href="/dashboard" className="cta-secondary text-xs">
              Open dashboard
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-white/80 dark:bg-slate-900/70 backdrop-blur border-b border-slate-200/70 dark:border-slate-700/70">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="h-12 w-12 rounded-2xl bg-white/95 dark:bg-slate-50 text-slate-900 flex items-center justify-center border border-slate-200/70 dark:border-slate-700/60 shadow-lg shadow-slate-900/10 dark:shadow-black/30">
                <Image
                  src="/brand/logo-mark.png"
                  alt="AI Status Dashboard Logo"
                  width={32}
                  height={32}
                  className="rounded-lg drop-shadow-sm dark:brightness-110"
                  priority
                />
              </div>
              <span className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white">
                AI Status Dashboard
              </span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <nav
              className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300"
              data-tour="nav"
            >
              <Link
                href="/dashboard"
                className="px-3 py-2 rounded-full hover:text-slate-900 dark:hover:text-white transition"
              >
                Dashboard
              </Link>
              <Link
                href="/casual"
                className="px-3 py-2 rounded-full hover:text-slate-900 dark:hover:text-white transition"
                data-tour="nav-casual"
              >
                Casual Mode
              </Link>
              <Link
                href="/casual/chatgpt"
                className="px-3 py-2 rounded-full hover:text-slate-900 dark:hover:text-white transition"
              >
                ChatGPT Status
              </Link>
              <Link
                href="/dashboard?tab=notifications"
                className="px-3 py-2 rounded-full hover:text-slate-900 dark:hover:text-white transition"
              >
                Notifications
              </Link>
              <Link
                href="/dashboard?tab=analytics"
                className="px-3 py-2 rounded-full hover:text-slate-900 dark:hover:text-white transition"
              >
                Analytics
              </Link>
              <Link
                href="/dashboard?tab=reliability"
                className="px-3 py-2 rounded-full hover:text-slate-900 dark:hover:text-white transition"
              >
                Reliability Lab
              </Link>
              <Link
                href="/dashboard?tab=api"
                className="px-3 py-2 rounded-full hover:text-slate-900 dark:hover:text-white transition"
              >
                API
              </Link>
              <a
                href="/rss.xml"
                className="px-3 py-2 rounded-full hover:text-slate-900 dark:hover:text-white transition"
                data-tour="nav-rss"
              >
                RSS
              </a>
            </nav>
            <DarkModeToggle />
            <button
              type="button"
              onClick={() => {
                if (typeof window === 'undefined') return;
                window.dispatchEvent(new CustomEvent('ai-status:start-tour', { detail: { mode: 'full' } }));
              }}
              className="cta-secondary text-xs"
              data-tour="nav-tour"
            >
              Guided tour
            </button>
            <Link href="/dashboard?tab=notifications" className="cta-primary text-xs" data-tour="nav-alerts">
              Get alerts
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-2">
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

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-slate-900/40 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Mobile Menu */}
          <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-700/70 z-50 md:hidden">
            <nav className="px-4 py-6 space-y-3 text-slate-700 dark:text-slate-200">
              {[
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/casual', label: 'Casual Mode' },
                { href: '/casual/chatgpt', label: 'ChatGPT Status' },
                { href: '/dashboard?tab=notifications', label: 'Notifications' },
                { href: '/dashboard?tab=analytics', label: 'Analytics' },
                { href: '/dashboard?tab=reliability', label: 'Reliability Lab' },
                { href: '/dashboard?tab=api', label: 'API' },
                { href: '/rss.xml', label: 'RSS' },
              ].map((item) =>
                item.href.startsWith('/rss') ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className="block py-3 px-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block py-3 px-4 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              )}
              <button
                type="button"
                onClick={() => {
                  if (typeof window === 'undefined') return;
                  window.dispatchEvent(new CustomEvent('ai-status:start-tour', { detail: { mode: 'full' } }));
                  setMobileMenuOpen(false);
                }}
                className="block w-full py-3 px-4 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 text-base font-medium text-left"
              >
                Guided tour
              </button>
              <Link
                href="/dashboard?tab=notifications"
                className="block py-3 px-4 rounded-xl bg-slate-900 text-white text-base font-semibold text-center"
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
