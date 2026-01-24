import { providerService } from '@/lib/services/providers';
import LandingSearch from './components/LandingSearch';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const providers = providerService.getProviders();

  return (
    <main className="flex-1">
      <h1 className="sr-only">AI Status Dashboard</h1>
      <section
        id="landing-hero"
        className="relative isolate px-4 sm:px-6 min-h-screen flex items-center"
      >
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.22),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(30,64,175,0.18),_transparent_58%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/95 to-slate-50/80 dark:from-slate-950 dark:via-slate-950/95 dark:to-slate-900/85" />
          <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/30 blur-[110px] dark:bg-emerald-500/10" />
        </div>

        <div className="max-w-2xl mx-auto w-full text-center animate-[rise_0.6s_ease-out]">
          <LandingSearch
            variant="hero"
            providers={providers.map((provider) => ({
              id: provider.id,
              name: provider.name,
              displayName: provider.displayName,
              aliases: provider.aliases,
            }))}
          />
        </div>
      </section>
    </main>
  );
}
