import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MCP Tools',
  description: 'Tool catalog for the AIStatusDashboard MCP server.',
  alternates: {
    canonical: '/docs/agent/mcp-tools',
  },
};

export default function McpToolsPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              MCP Tools
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Tool catalog
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Read-only tools for status summaries, incidents, metrics, and policy generation.
            </p>
          </header>

          <section className="surface-card p-6 space-y-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Tools</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-6 space-y-2">
              <li>status.get_summary</li>
              <li>status.get_health_matrix</li>
              <li>incidents.search</li>
              <li>incidents.get</li>
              <li>metrics.query</li>
              <li>recommendations.get_fallback_plan</li>
              <li>policy.generate</li>
            </ul>
          </section>

          <section className="surface-card p-6 space-y-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Resources</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-6 space-y-2">
              <li>resource://providers</li>
              <li>resource://providers/{'{'}provider{'}'}/surfaces</li>
              <li>resource://providers/{'{'}provider{'}'}/regions</li>
              <li>resource://providers/{'{'}provider{'}'}/models</li>
              <li>resource://incidents/{'{'}incident_id{'}'}</li>
              <li>resource://metrics/{'{'}provider{'}'}/{'{'}metric{'}'}?since=...&amp;until=...</li>
              <li>resource://docs/agent/quickstart</li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
