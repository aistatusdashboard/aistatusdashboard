import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Docs',
  description: 'Public REST API endpoints and OpenAPI specs for AIStatusDashboard.',
  alternates: {
    canonical: '/docs/api',
  },
};

const BASE_URL = 'https://aistatusdashboard.com/api/public/v1';

export default function ApiDocsPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Public API
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              REST API overview
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Base URL: <code className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{BASE_URL}</code>
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Core endpoints</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-6">
              <li>GET /status/summary</li>
              <li>GET /status/health-matrix</li>
              <li>GET /incidents</li>
              <li>GET /metrics</li>
              <li>GET /casual/status?app=chatgpt</li>
              <li>POST /casual/reports</li>
              <li>POST /recommendations/fallback_plan</li>
              <li>POST /policy/generate</li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Every response includes <code>request_id</code>, <code>generated_at</code>, <code>evidence</code>, and
              <code>confidence</code>.
            </p>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">OpenAPI specs</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-disc pl-6">
              <li><a className="underline" href="/openapi.json">/openapi.json</a></li>
              <li><a className="underline" href="/openapi.yaml">/openapi.yaml</a></li>
              <li><a className="underline" href="/openapi-3.0.json">/openapi-3.0.json</a></li>
              <li><a className="underline" href="/openapi-3.0.yaml">/openapi-3.0.yaml</a></li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
