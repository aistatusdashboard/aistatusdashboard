import type { Metadata } from 'next';
import Link from 'next/link';
import { MCP_REGISTRY_URL } from '@/lib/config/links';

export const metadata: Metadata = {
  title: 'Developer hub',
  description:
    'API, OpenAPI, MCP, datasets, embed widget, and reliability lab for AIStatusDashboard.',
  alternates: { canonical: '/developer' },
  openGraph: {
    title: 'Developer hub | AI Status Dashboard',
    description: 'API, OpenAPI spec, MCP server, datasets, and embed widgets for AI provider status.',
  },
  twitter: {
    title: 'Developer hub | AI Status Dashboard',
    description: 'API, OpenAPI spec, MCP server, datasets, and embed widgets for AI provider status.',
  },
};

export default function DeveloperPage() {
  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="surface-card-strong p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Developer</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">
            Build with AI status data
          </h1>
        </header>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">API quickstart</h2>
          <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 overflow-x-auto text-xs">
{`curl "https://aistatusdashboard.com/api/public/v1/status/summary?provider=openai&lens=observed"`}
          </pre>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">OpenAPI spec</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Full public API schema with examples and envelope fields.
          </p>
          <div className="text-sm space-x-4">
            <Link href="/openapi.json" className="underline">/openapi.json</Link>
            <Link href="/openapi.yaml" className="underline">/openapi.yaml</Link>
            <Link href="/.well-known/openapi.json" className="underline">/.well-known/openapi.json</Link>
          </div>
          <iframe
            title="OpenAPI viewer"
            src="https://editor.swagger.io/?url=https://aistatusdashboard.com/openapi.json"
            className="w-full min-h-[420px] rounded-xl border border-slate-200/70 dark:border-slate-700/70"
          />
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">MCP server</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Use the streamable HTTP MCP endpoint to query status and incidents from agent workflows.
          </p>
          <div className="text-sm">
            <Link href="/mcp" className="underline">https://aistatusdashboard.com/mcp</Link>
          </div>
          <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 overflow-x-auto text-xs">
{`npx @modelcontextprotocol/inspector https://aistatusdashboard.com/mcp`}
          </pre>
          <a href={MCP_REGISTRY_URL} className="underline text-sm">
            MCP Registry listing →
          </a>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Datasets</h2>
          <div className="text-sm space-x-4">
            <Link href="/datasets" className="underline">/datasets</Link>
            <Link href="/datasets/incidents.ndjson" className="underline">/datasets/incidents.ndjson</Link>
            <Link href="/datasets/metrics.csv" className="underline">/datasets/metrics.csv</Link>
          </div>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Embed widget</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Publish status badges in web pages, docs, and READMEs.
          </p>
          <Link href="/embed" className="underline text-sm">
            Open embed docs →
          </Link>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Reliability lab</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Advanced analytics and forecasting for operators.
          </p>
          <Link href="/dashboard?tab=reliability" className="underline text-sm">
            Open reliability tab →
          </Link>
        </section>
      </div>
    </main>
  );
}
