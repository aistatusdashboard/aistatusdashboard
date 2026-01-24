import type { Metadata } from 'next';
import Link from 'next/link';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';

export const metadata: Metadata = {
  title: 'Incidents',
  description: 'Recent AI provider incidents tracked by AIStatusDashboard.',
  alternates: {
    canonical: '/incidents',
  },
};

export const dynamic = 'force-dynamic';

export default async function IncidentsPage() {
  const incidents = (await intelligenceService.getIncidents({ limit: 50 }))
    .map(normalizeIncidentDates)
    .slice(0, 50);

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Incidents
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Recent incident timeline
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Latest incidents across monitored AI providers.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <a href="/api/public/v1/incidents" className="cta-secondary text-xs">Incidents API</a>
              <a href="/openapi.json" className="cta-secondary text-xs">OpenAPI</a>
              <a href="/rss.xml" className="cta-secondary text-xs">RSS</a>
            </div>
          </header>

          <section className="space-y-3">
            {incidents.map((incident) => (
              <div key={`${incident.providerId}:${incident.id}`} className="surface-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {incident.providerId}
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {incident.title}
                    </h2>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200">
                    {incident.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Updated: {incident.updatedAt}
                </p>
                <div className="mt-3">
                  <Link href={`/incidents/${incident.providerId}:${incident.id}`} className="cta-secondary text-xs">
                    View incident
                  </Link>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
