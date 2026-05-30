import type { Metadata } from 'next';
import Link from 'next/link';
import McpCallout from '@/app/components/McpCallout';
import { MCP_REGISTRY_URL } from '@/lib/config/links';

export const metadata: Metadata = {
  title: 'AI Integration',
  description: 'One landing page for AI agents to discover MCP and OpenAPI endpoints.',
  alternates: {
    canonical: '/ai',
  },
};

export default function AiLandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AI Status Dashboard',
    applicationCategory: 'WebApplication',
    operatingSystem: 'Web',
    url: 'https://aistatusdashboard.com/ai',
    description:
      'AI reliability control plane: status, incidents, metrics, and fallback policy generation across AI providers.',
    offers: { '@type': 'Offer', price: '0' },
    sameAs: [
      'https://github.com/aistatusdashboard/aistatusdashboard',
      MCP_REGISTRY_URL,
    ],
  };

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <McpCallout />

          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              One URL for AIs
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              AI discoverability hub
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              AI reliability control plane: status, incidents, metrics, and fallback policy generation across major AI providers.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Quick links</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/mcp" className="cta-secondary text-xs">MCP endpoint</Link>
              <a href="/llms.txt" className="cta-secondary text-xs">llms.txt</a>
              <a href="/llms-full.txt" className="cta-secondary text-xs">llms-full.txt</a>
              <a href="/openapi.json" className="cta-secondary text-xs">OpenAPI JSON</a>
              <a href="/.well-known/openapi.json" className="cta-secondary text-xs">Well-known OpenAPI</a>
              <a href="/.well-known/ai-plugin.json" className="cta-secondary text-xs">AI Plugin</a>
              <Link href="/docs/agent/mcp-quickstart" className="cta-secondary text-xs">
                MCP quickstart
              </Link>
              <a href={MCP_REGISTRY_URL} className="cta-secondary text-xs">
                MCP Registry
              </a>
              <a href="https://github.com/aistatusdashboard/aistatusdashboard" className="cta-secondary text-xs">
                GitHub repo
              </a>
              <Link href="/reports/weekly-ai-reliability" className="cta-secondary text-xs">
                Weekly reliability report
              </Link>
              <Link href="/reports/monthly-provider-scorecards" className="cta-secondary text-xs">
                Monthly provider scorecards
              </Link>
              <Link href="/casual/chatgpt" className="cta-secondary text-xs">
                Casual Mode (ChatGPT)
              </Link>
              <Link href="/casual" className="cta-secondary text-xs">
                Casual Mode hub
              </Link>
              <Link href="/docs/discoverability-audit" className="cta-secondary text-xs">
                Discoverability audit
              </Link>
              <a href="/discovery/audit/latest.json" className="cta-secondary text-xs">
                Discovery audit (JSON)
              </a>
            </div>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Build on AI Status Dashboard</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Stable public surfaces for apps, agents, and search systems.
            </p>
            <div className="grid gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Public APIs</p>
                <pre className="text-xs text-slate-800 dark:text-slate-100 overflow-auto">
{`/api/public/v1/status/summary
/api/public/v1/incidents
/api/public/v1/providers`}
                </pre>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Datasets</p>
                <pre className="text-xs text-slate-800 dark:text-slate-100 overflow-auto">
{`/datasets/incidents.ndjson
/datasets/metrics.csv`}
                </pre>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Discovery</p>
                <pre className="text-xs text-slate-800 dark:text-slate-100 overflow-auto">
{`/llms.txt
/openapi.json
/.well-known/ai-plugin.json`}
                </pre>
              </div>
            </div>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Copy-paste examples</h2>
            <div className="grid gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Status summary (curl)</p>
                <pre className="text-xs text-slate-800 dark:text-slate-100 overflow-auto">
{`curl https://aistatusdashboard.com/api/public/v1/status/summary`}
                </pre>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Incidents search (curl)</p>
                <pre className="text-xs text-slate-800 dark:text-slate-100 overflow-auto">
{`curl "https://aistatusdashboard.com/api/public/v1/incidents?provider=openai&limit=5"`}
                </pre>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">MCP connection</p>
                <pre className="text-xs text-slate-800 dark:text-slate-100 overflow-auto">
{`Endpoint: https://aistatusdashboard.com/mcp
Tools: status_summary, search_incidents, list_providers`}
                </pre>
              </div>
            </div>
          </section>

          <noscript>
            <div className="surface-card p-4">
              <p>
                Key endpoints: /api/public/v1/status/summary, /api/public/v1/incidents, /openapi.json, /llms.txt
              </p>
            </div>
          </noscript>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </div>
      </div>
    </main>
  );
}
