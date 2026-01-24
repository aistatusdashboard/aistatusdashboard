import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';
import { providerService } from '@/lib/services/providers';

export const dynamic = 'force-dynamic';

export default async function MonthlyProviderScorecards() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const incidents = (await intelligenceService.getIncidents({ startDate: since.toISOString(), limit: 500 }))
    .map(normalizeIncidentDates);

  const providers = providerService.getProviders();
  const stats = new Map<string, { count: number; degradedMinutes: number; mttrSamples: number[] }>();

  incidents.forEach((incident) => {
    const key = incident.providerId;
    if (!key) return;
    const entry = stats.get(key) || { count: 0, degradedMinutes: 0, mttrSamples: [] };
    entry.count += 1;
    const start = Date.parse(incident.startedAt);
    const end = incident.resolvedAt ? Date.parse(incident.resolvedAt) : Date.parse(incident.updatedAt);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      const minutes = Math.max(1, Math.round((end - start) / 60000));
      entry.degradedMinutes += minutes;
      if (incident.resolvedAt) {
        entry.mttrSamples.push(minutes);
      }
    }
    stats.set(key, entry);
  });

  const rows = providers.map((provider) => {
    const entry = stats.get(provider.id) || { count: 0, degradedMinutes: 0, mttrSamples: [] };
    const mttr =
      entry.mttrSamples.length > 0
        ? Math.round(entry.mttrSamples.reduce((acc, value) => acc + value, 0) / entry.mttrSamples.length)
        : null;
    const reliabilityScore = Math.max(
      0,
      Math.min(100, Math.round(100 - entry.count * 4 - entry.degradedMinutes / 120))
    );
    return {
      id: provider.id,
      name: provider.displayName || provider.name,
      incidentCount: entry.count,
      degradedMinutes: entry.degradedMinutes,
      mttr,
      reliabilityScore,
    };
  });

  const topRows = rows
    .sort((a, b) => b.reliabilityScore - a.reliabilityScore)
    .slice(0, 10);

  const topIncidents = incidents.slice(0, 20);
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10 max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Monthly Provider Scorecards</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Provider reliability rollups (incident frequency, degraded minutes, MTTR).
        </p>
        <section className="surface-card p-6 space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Top providers (30d)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Reliability score = 100 - (incidents × 4) - (degraded minutes ÷ 120).
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-600 dark:text-slate-300">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700/70">
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Incidents (30d)</th>
                  <th className="py-2 pr-4">Degraded min</th>
                  <th className="py-2 pr-4">MTTR</th>
                  <th className="py-2">Reliability</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100/70 dark:border-slate-800/60">
                    <td className="py-2 pr-4">
                      <a href={`/provider/${row.id}`} className="font-medium text-slate-900 dark:text-white hover:underline">
                        {row.name}
                      </a>
                    </td>
                    <td className="py-2 pr-4">{row.incidentCount}</td>
                    <td className="py-2 pr-4">{row.degradedMinutes}</td>
                    <td className="py-2 pr-4">{row.mttr !== null ? `${row.mttr} min` : '—'}</td>
                    <td className="py-2 font-semibold">{row.reliabilityScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Citations</h2>
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
