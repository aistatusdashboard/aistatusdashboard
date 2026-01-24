import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Status',
  description: 'Current status and incidents snapshot.',
  alternates: { canonical: '/status' },
};

export default function StatusPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10 max-w-5xl mx-auto space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Status</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          For real-time view, see the homepage. Snapshot links below are static/SSR-friendly.
        </p>
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300">
          <li><a href="/api/public/v1/status/summary">/api/public/v1/status/summary</a></li>
          <li><a href="/api/public/v1/incidents">/api/public/v1/incidents</a></li>
          <li><a href="/openapi.json">/openapi.json</a></li>
          <li><a href="/llms.txt">/llms.txt</a></li>
        </ul>
        <noscript>
          <div className="surface-card p-4">
            <p>Noscript snapshot: status summary available via /api/public/v1/status/summary</p>
          </div>
        </noscript>
      </div>
    </main>
  );
}
