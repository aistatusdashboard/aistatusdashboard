import type { Metadata } from 'next';
import Link from 'next/link';
import { intelligenceService } from '@/lib/services/intelligence';
import { providerService } from '@/lib/services/providers';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';
import { formatTimeAgo } from '@/lib/utils/time';

const description =
  'Recent outages and incidents across ChatGPT, Claude, Gemini, and the other AI apps we watch — with links to the original reports.';

export const metadata: Metadata = {
  title: 'AI outage history',
  description,
  alternates: {
    canonical: '/incidents',
  },
  openGraph: {
    title: 'AI outage history | AI Status',
    description,
  },
  twitter: {
    title: 'AI outage history | AI Status',
    description,
  },
};

export const dynamic = 'force-dynamic';

const RESOLVED_STATUSES = new Set(['resolved', 'completed', 'cancelled']);

function providerLabel(providerId: string): string {
  const provider = providerService.getProvider(providerId);
  return provider?.displayName || provider?.name || providerId;
}

export default async function IncidentsPage() {
  const incidents = (await intelligenceService.getIncidents({ limit: 50 }))
    .map(normalizeIncidentDates)
    .slice(0, 50);

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Outage history
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            What broke recently across the AI apps we watch, newest first. Every entry links to
            the incident detail and the provider&apos;s original report.
          </p>
        </header>

        <section className="space-y-3">
          {incidents.length === 0 && (
            <p className="surface-card p-5 text-sm text-slate-600 dark:text-slate-300">
              Nothing recorded recently — a good sign. Check back after the next outage.
            </p>
          )}
          {incidents.map((incident) => {
            const resolved =
              RESOLVED_STATUSES.has(String(incident.status || '').toLowerCase()) ||
              Boolean(incident.resolvedAt);
            return (
              <Link
                key={`${incident.providerId}:${incident.id}`}
                href={`/incidents/${incident.providerId}:${incident.id}`}
                className="surface-card p-5 block hover:-translate-y-0.5 hover:shadow-lg transition"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {providerLabel(incident.providerId)} · {formatTimeAgo(incident.updatedAt)}
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-1">
                      {incident.title}
                    </h2>
                  </div>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full border shrink-0 ${
                      resolved
                        ? 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700'
                        : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                    }`}
                  >
                    {resolved ? 'Resolved' : 'Ongoing'}
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
