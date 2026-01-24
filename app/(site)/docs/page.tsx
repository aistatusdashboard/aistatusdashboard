import type { Metadata } from 'next';
import Link from 'next/link';
import McpCallout from '@/app/components/McpCallout';

export const metadata: Metadata = {
  title: 'Docs',
  description: 'AIStatusDashboard documentation for APIs, MCP tools, and datasets.',
  alternates: {
    canonical: '/docs',
  },
};

export default function DocsPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <McpCallout />

          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Documentation
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              AIStatusDashboard docs
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Everything you need to call the public API, integrate MCP tools, and browse datasets.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Public API</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Use the REST API for status summaries, incident search, and metrics time series.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/docs/api" className="cta-secondary text-xs">
                API docs
              </Link>
              <a href="/openapi.json" className="cta-secondary text-xs">
                OpenAPI JSON
              </a>
              <a href="/openapi.yaml" className="cta-secondary text-xs">
                OpenAPI YAML
              </a>
            </div>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">MCP tools</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Call MCP tools for status summaries, incidents, metrics, fallback plans, and policy generation.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/docs/agent/mcp-quickstart" className="cta-secondary text-xs">
                MCP quickstart
              </Link>
              <Link href="/docs/agent/mcp-tools" className="cta-secondary text-xs">
                MCP tools
              </Link>
            </div>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Casual Mode</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Consumer-first status pages with symptoms, guidance, and \"is it just me?\" indicators.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/casual/chatgpt" className="cta-secondary text-xs">
                ChatGPT Status
              </Link>
              <Link href="/casual/claude" className="cta-secondary text-xs">
                Claude Status
              </Link>
              <Link href="/casual/gemini" className="cta-secondary text-xs">
                Gemini Status
              </Link>
              <Link href="/casual" className="cta-secondary text-xs">
                Casual mode hub
              </Link>
            </div>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Datasets</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Browse public datasets with schema.org metadata for incidents and metrics.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/datasets" className="cta-secondary text-xs">
                Data catalog
              </Link>
              <Link href="/reports/weekly-ai-reliability" className="cta-secondary text-xs">
                Weekly report
              </Link>
              <Link href="/reports/monthly-provider-scorecards" className="cta-secondary text-xs">
                Monthly scorecards
              </Link>
            </div>
          </section>

          <noscript>
            <div className="surface-card p-4">
              <p>Docs snapshot: /docs.md, /docs/api.md, /docs/agent/mcp-quickstart.md</p>
            </div>
          </noscript>
        </div>
      </div>
    </main>
  );
}
