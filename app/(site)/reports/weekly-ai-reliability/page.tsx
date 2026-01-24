import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';

export const dynamic = 'force-dynamic';

export default async function WeeklyReliabilityReport() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const incidents = (await intelligenceService.getIncidents({ startDate: since.toISOString(), limit: 200 }))
    .map(normalizeIncidentDates);

  const majorIncidents = incidents.filter((incident) => {
    const severity = String(incident.severity || incident.sourceSeverity || '').toLowerCase();
    return severity.includes('major') || severity.includes('down') || severity.includes('outage');
  });

  const durations = incidents
    .map((incident) => {
      if (!incident.resolvedAt || !incident.startedAt) return null;
      const duration = Date.parse(incident.resolvedAt) - Date.parse(incident.startedAt);
      if (!Number.isFinite(duration) || duration <= 0) return null;
      return Math.max(1, Math.round(duration / 60000));
    })
    .filter((value): value is number => typeof value === 'number');

  const sortedDurations = durations.slice().sort((a, b) => a - b);
  const medianDuration =
    sortedDurations.length > 0
      ? sortedDurations[Math.floor(sortedDurations.length / 2)]
      : null;
  const generatedAt = new Date().toLocaleString('en-US');

  const topIncidents = incidents.slice(0, 10);
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10 max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Weekly AI Reliability Report</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Highlights from the last 7 days across providers, with citations to incident evidence.
        </p>
        <div className="surface-card p-5 text-sm text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-3">
          <span>Generated at: {generatedAt}</span>
          <span>•</span>
          <span>Incidents (7d): {incidents.length}</span>
          <span>•</span>
          <span>Major: {majorIncidents.length}</span>
          <span>•</span>
          <span>Median time-to-resolve: {medianDuration ? `${medianDuration} min` : '—'}</span>
        </div>
        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Top incidents</h2>
          <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300">
            {topIncidents.map((incident) => (
              <li key={incident.id}>
                <a href={`/incidents/${incident.providerId}:${incident.id}`}>{incident.title}</a>{' '}
                (<a href={`/incidents/${incident.providerId}:${incident.id}/cite`}>cite</a>){' '}
                {incident.rawUrl && <a href={incident.rawUrl}>official</a>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
