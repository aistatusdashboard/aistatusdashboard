import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Discoverability Audit',
  description: 'Self-service audit checklist for AIStatusDashboard discovery surfaces.',
  alternates: {
    canonical: '/docs/discoverability-audit',
  },
};

const ENDPOINTS = [
  { path: '/ai', type: 'text/html' },
  { path: '/robots.txt', type: 'text/plain' },
  { path: '/sitemap.xml', type: 'application/xml' },
  { path: '/rss.xml', type: 'application/rss+xml' },
  { path: '/llms.txt', type: 'text/plain' },
  { path: '/llms-full.txt', type: 'text/plain' },
  { path: '/openapi.json', type: 'application/json' },
  { path: '/openapi.yaml', type: 'application/yaml' },
  { path: '/.well-known/openapi.json', type: 'application/json' },
  { path: '/.well-known/ai-plugin.json', type: 'application/json' },
  { path: '/mcp', type: 'text/plain' },
  { path: '/providers', type: 'text/html' },
  { path: '/datasets/incidents.ndjson', type: 'application/x-ndjson' },
  { path: '/datasets/metrics.csv', type: 'text/csv' },
  { path: '/docs.md', type: 'text/markdown' },
  { path: '/docs/api.md', type: 'text/markdown' },
  { path: '/docs/citations.md', type: 'text/markdown' },
  { path: '/docs/agent/mcp-quickstart.md', type: 'text/markdown' },
];

export default function DiscoverabilityAuditPage() {
  const verifiedAt = new Date().toISOString();

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Discoverability
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Discoverability audit
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Quick checklist for AI and crawler access to AIStatusDashboard public surfaces.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Last verified: {verifiedAt}
            </p>
          </header>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Required endpoints</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2">URL</th>
                    <th className="py-2">Expected status</th>
                    <th className="py-2">Content-Type</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-300">
                  {ENDPOINTS.map((endpoint) => (
                    <tr key={endpoint.path} className="border-t border-slate-200/70 dark:border-slate-700/60">
                      <td className="py-2">
                        <a href={endpoint.path} className="text-blue-600 hover:text-blue-700 underline">
                          {SITE_URL}{endpoint.path}
                        </a>
                      </td>
                      <td className="py-2">200</td>
                      <td className="py-2">{endpoint.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface-card p-6 space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Verify with curl</h2>
            <pre className="text-xs text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/50 p-4 rounded">
{`curl -i https://aistatusdashboard.com/sitemap.xml
curl -i https://aistatusdashboard.com/rss.xml
curl -i https://aistatusdashboard.com/datasets/incidents.ndjson
curl -i https://aistatusdashboard.com/datasets/metrics.csv
curl -i https://aistatusdashboard.com/llms.txt
curl -i https://aistatusdashboard.com/openapi.yaml`}
            </pre>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              For the full audit output, see the Markdown mirror.
            </p>
            <a href="/docs/discoverability-audit.md" className="cta-secondary text-xs">
              Markdown mirror
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
