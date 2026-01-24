import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'Learn how AI Status Dashboard ingests official status pages, synthetic probes, and telemetry to surface reliable AI provider availability.',
  alternates: {
    canonical: '/how-it-works',
  },
};

export default function HowItWorksPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Methodology
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              How AI Status Dashboard works
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              We combine official status feeds, normalized incidents, and real-time probes to give teams a
              trustworthy picture of AI provider health in under a minute.
            </p>
          </header>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">1. Official status ingestion</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We ingest public status endpoints (Statuspage, Instatus, Status.io, RSS, and provider APIs) on a
              tight cadence. Incidents, components, and maintenances are normalized into a unified format so
              you can compare providers side by side.
            </p>
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">2. Synthetic probes</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We run deterministic canary requests against AI provider APIs to measure latency, errors, and
              response correctness. If probes are inconclusive or blocked by account limits, we default to
              operational and flag the signal as advisory rather than declaring an outage.
            </p>
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">3. Telemetry overlays</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Optional telemetry allows teams to compare their own experience to global signals. We never
              log prompts or outputs by default; we store only aggregates needed for reliability insights.
            </p>
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">4. Evidence-first alerts</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Every alert is backed by timestamps, thresholds, and raw evidence. This reduces false positives
              and helps teams decide when to fail over or throttle usage.
            </p>
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">5. Transparency & trust</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We always link to official status pages and make it clear when data is aggregated or when
              signals are advisory. If we cannot verify a status confidently, we default to operational.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/providers" className="cta-secondary text-xs">
                Browse providers
              </Link>
              <Link href="/" className="cta-secondary text-xs">
                View dashboard
              </Link>
            </div>
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Build on AIStatusDashboard</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Use stable public surfaces to integrate reliability data into your workflows.
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-6 space-y-2">
              <li>MCP endpoint: https://aistatusdashboard.com/mcp</li>
              <li>OpenAPI: https://aistatusdashboard.com/openapi.json</li>
              <li>Public JSON: /api/public/v1/status/summary, /api/public/v1/incidents</li>
              <li>Datasets: /datasets/incidents.ndjson, /datasets/metrics.csv</li>
              <li>Discovery audit: /docs/discoverability-audit.md</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
