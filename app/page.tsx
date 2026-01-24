import { providerService } from '@/lib/services/providers';
import LandingSearch from './components/LandingSearch';
import LivePulse from './components/LivePulse';
import { getChangelogEntries } from '@/lib/services/changelog';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const providers = providerService.getProviders();
  const changelog = await getChangelogEntries(5);

  return (
    <main className="flex-1">
      <h1 className="sr-only">AI Status Dashboard</h1>
      <section className="relative isolate px-4 sm:px-6 py-24 md:py-32 min-h-[70vh] flex items-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.22),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(30,64,175,0.18),_transparent_58%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/95 to-slate-50/80 dark:from-slate-950 dark:via-slate-950/95 dark:to-slate-900/85" />
          <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/30 blur-[110px] dark:bg-emerald-500/10" />
        </div>

        <div className="max-w-3xl mx-auto w-full text-center space-y-8 animate-[rise_0.6s_ease-out]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.5em] text-slate-500 dark:text-slate-400">
              AI Status Dashboard
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Find the status of any AI provider in seconds.
            </p>
          </div>
          <LandingSearch
            variant="hero"
            providers={providers.map((provider) => ({
              id: provider.id,
              name: provider.name,
              displayName: provider.displayName,
              aliases: provider.aliases,
            }))}
          />
          <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Popular:</span>
            <Link href="/casual/chatgpt" className="hover:text-slate-900 dark:hover:text-white transition">
              ChatGPT
            </Link>
            <span>•</span>
            <Link href="/casual/claude" className="hover:text-slate-900 dark:hover:text-white transition">
              Claude
            </Link>
            <span>•</span>
            <Link href="/casual/gemini" className="hover:text-slate-900 dark:hover:text-white transition">
              Gemini
            </Link>
            <span>•</span>
            <Link href="/providers" className="hover:text-slate-900 dark:hover:text-white transition">
              All providers
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-5xl mx-auto space-y-10">
          <LivePulse />
          <div className="surface-card p-5 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  What&apos;s new
                </p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-2">
                  Latest updates
                </h3>
              </div>
              <Link
                href="/changelog"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                View changelog →
              </Link>
            </div>
            {changelog.entries.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No recent updates logged yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {changelog.entries.map((entry) => (
                  <li
                    key={`${entry.date}-${entry.title}`}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">
                      {entry.title}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {entry.date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <noscript>
        <div className="px-4 sm:px-6 pb-10">
          <div className="max-w-3xl mx-auto surface-card p-4 text-sm">
            <p className="font-semibold">No JavaScript? Browse providers directly:</p>
            <a href="/providers" className="underline">
              /providers
            </a>
          </div>
        </div>
      </noscript>
    </main>
  );
}
