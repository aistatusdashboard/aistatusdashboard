import { providerService } from '@/lib/services/providers';
import LandingSearch from './components/LandingSearch';

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  const providers = providerService.getProviders();

  return (
    <main className="flex-1">
      <h1 className="sr-only">AI Status Dashboard</h1>
      <section className="relative isolate px-4 sm:px-6 py-20 md:py-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_58%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.18),_transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-slate-50/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/80" />
        </div>

        <div className="max-w-3xl mx-auto text-center space-y-8">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
            AI Status Dashboard
          </p>
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
