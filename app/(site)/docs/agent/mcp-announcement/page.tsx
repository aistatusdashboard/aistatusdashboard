import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MCP Announcement',
  description: 'Announcement and overview for the AIStatusDashboard MCP server launch.',
  alternates: {
    canonical: '/docs/agent/mcp-announcement',
  },
};

export default function McpAnnouncementPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Announcement
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              AIStatusDashboard MCP server is live
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              The MCP endpoint is now available for agents to query status summaries, incidents, metrics,
              fallback plans, and policy recommendations.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">What&apos;s included</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-6 space-y-2">
              <li>Read-only tools for status, incidents, metrics, fallback plans, and policies</li>
              <li>Resources for providers, regions, models, and incident details</li>
              <li>OpenAPI endpoints for REST-based automation</li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Stable public surfaces are now maintained for discovery: MCP, OpenAPI JSON/YAML, RSS, sitemap,
              datasets (NDJSON/CSV), and markdown mirrors for docs and status pages.
            </p>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Start here</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/mcp" className="cta-secondary text-xs">MCP endpoint</a>
              <a href="/docs/agent/mcp-quickstart" className="cta-secondary text-xs">MCP quickstart</a>
              <a href="/openapi.json" className="cta-secondary text-xs">OpenAPI</a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
