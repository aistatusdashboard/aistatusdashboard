import Link from "next/link";
import { loadPublicStats } from "@/lib/services/public-stats";

export const dynamic = "force-dynamic";

function num(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function StatsPage() {
  const stats = await loadPublicStats();
  return (
    <main className="px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="surface-card p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Public Stats
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
            AI Status Dashboard Stats
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Generated {stats.generated_at} · JSON: <a className="underline" href="/stats.json">/stats.json</a>
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="surface-card p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Providers tracked</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{num(stats.providers_tracked)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Avg latency</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{num(stats.avg_latency_ms_current)} ms</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Incidents (24h)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{num(stats.incidents_24h)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Community reports (10m)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{num(stats.community_reports_10m)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Fallback plans (7d)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{num(stats.fallback_plans_generated_7d)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Policies generated (7d)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{num(stats.policies_generated_7d)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Distinct domains (30d)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{num(stats.distinct_referrer_domains_30d)}</p>
          </div>
        </section>

        <section className="surface-card p-6 text-sm text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Counters</h2>
          <ul className="mt-3 space-y-2">
            <li>Incidents 7d: {num(stats.incidents_7d_total)}</li>
            <li>Incidents 30d: {num(stats.incidents_30d_total)}</li>
            <li>Active incidents now: {num(stats.active_incidents_now)}</li>
            <li>Community reports 7d: {num(stats.community_reports_7d)}</li>
            <li>Casual status calls 7d: {num(stats.casual_status_calls_7d)}</li>
            <li>Casual status calls 30d: {num(stats.casual_status_calls_30d)}</li>
            <li>Last check: {stats.last_check_ts || "n/a"}</li>
          </ul>
        </section>

        <p className="text-sm">
          <Link href="/" className="underline">Back to homepage</Link>
        </p>
      </div>
    </main>
  );
}
