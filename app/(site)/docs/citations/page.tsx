import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Citations',
  description: 'How to cite AIStatusDashboard incidents and datasets.',
  alternates: {
    canonical: '/docs/citations',
  },
};

export default function CitationsPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Citations
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Citing AIStatusDashboard
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Use the evidence bundle and dataset links below when you cite incidents or metrics.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Key references</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>AI landing: https://aistatusdashboard.com/ai</li>
              <li>OpenAPI: https://aistatusdashboard.com/openapi.json</li>
              <li>MCP: https://aistatusdashboard.com/mcp</li>
              <li>Datasets: https://aistatusdashboard.com/datasets</li>
              <li>Incident citation endpoint: https://aistatusdashboard.com/incidents/{'{id}'}/cite</li>
            </ul>
          </section>

          <section className="surface-card p-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">How to cite incidents</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Use the /incidents/{'{id}'}/cite endpoint for a JSON evidence bundle.</li>
              <li>Include the permalink and generated_at timestamp.</li>
              <li>Include source_urls (official status pages) from the cite payload.</li>
            </ol>
          </section>

          <section className="surface-card p-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Datasets</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Incidents NDJSON: https://aistatusdashboard.com/datasets/incidents.ndjson</li>
              <li>Metrics CSV: https://aistatusdashboard.com/datasets/metrics.csv</li>
            </ul>
          </section>

          <section className="surface-card p-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Markdown mirror</h2>
            <a href="/docs/citations.md" className="cta-secondary text-xs">
              View citations markdown
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
