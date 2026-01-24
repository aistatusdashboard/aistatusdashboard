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
      <section className="relative isolate px-4 sm:px-6 py-20 md:py-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_58%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.18),_transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-slate-50/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/80" />
        </div>

        <div className="max-w-4xl mx-auto space-y-10">
          <LivePulse />
          <div className="text-center space-y-6">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
            AI Status Dashboard
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Link href="/casual/chatgpt" className="px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 hover:text-slate-900 dark:hover:text-white transition">
              ChatGPT status
            </Link>
            <Link href="/casual/claude" className="px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 hover:text-slate-900 dark:hover:text-white transition">
              Claude status
            </Link>
            <Link href="/casual/gemini" className="px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 hover:text-slate-900 dark:hover:text-white transition">
              Gemini status
            </Link>
            <Link href="/providers" className="px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 hover:text-slate-900 dark:hover:text-white transition">
              View all providers
            </Link>
          </div>
          <LandingSearch
            providers={providers.map((provider) => ({
              id: provider.id,
              name: provider.name,
              displayName: provider.displayName,
              aliases: provider.aliases,
            }))}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Try: ChatGPT, Claude, Gemini, OpenAI, Anthropic
          </p>
          </div>

          <div className="surface-card p-5 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">What&apos;s new</p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-2">Latest updates</h3>
              </div>
              <Link href="/changelog" className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
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
                  <li key={`${entry.date}-${entry.title}`} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{entry.title}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{entry.date}</span>
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
