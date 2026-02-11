import Link from 'next/link';

export const metadata = {
  title: 'System Health',
  description: 'Public health checks and site reliability endpoints for AI Status Dashboard.',
};

export default function SystemHealthPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10 max-w-4xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            System
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">System Health</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Public checks for uptime, status summaries, and site health automation.
          </p>
        </header>

        <section className="surface-card p-5 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Health endpoints</h2>
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <li>
              <Link className="underline" href="/api/health">/api/health</Link> — runtime health check
            </li>
            <li>
              <Link className="underline" href="/api/public/v1/status/summary">
                /api/public/v1/status/summary
              </Link>{' '}
              — public status summary JSON
            </li>
            <li>
              <Link className="underline" href="/status/site-health">/status/site-health</Link> — site health job
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
