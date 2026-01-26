import Link from 'next/link';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';
import { providerService } from '@/lib/services/providers';
import { formatTimeAgo } from '@/lib/utils/time';

const STATUS_COPY = {
  operational: {
    label: 'All systems operational',
    tone: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  degraded: {
    label: 'Some services degraded',
    tone: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  down: {
    label: 'Service issues detected',
    tone: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  maintenance: {
    label: 'Scheduled maintenance in progress',
    tone: 'text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  unknown: {
    label: 'Status is updating',
    tone: 'text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
} as const;

export default async function LivePulse() {
  const snapshot = await getLivePulseSnapshot();
  const statusMeta = STATUS_COPY[snapshot.status] || STATUS_COPY.unknown;
  const updatedAgo = formatTimeAgo(snapshot.lastUpdated);
  const providerMap = new Map(
    providerService.getProviders().map((provider) => [
      provider.id,
      provider.displayName || provider.name,
    ])
  );

  return (
    <section className="surface-card-strong p-6 md:p-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Live Pulse
          </p>
          <h2 className={`text-2xl font-semibold ${statusMeta.tone} mt-2 flex items-center gap-2`}>
            <span className={`h-3 w-3 rounded-full ${statusMeta.dot}`} aria-hidden="true" />
            {statusMeta.label}
          </h2>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
          <div>Updated {updatedAgo}</div>
          <div>Updated every 60s</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-slate-700 dark:text-slate-200">
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Tracking</p>
          <p className="mt-2 inline-flex items-baseline gap-2 whitespace-nowrap leading-none">
            <span className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {snapshot.tracking}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">providers</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Avg latency</p>
          {snapshot.avgLatency !== null ? (
            <p className="mt-2 inline-flex items-baseline gap-2 whitespace-nowrap leading-none">
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
                {snapshot.avgLatency}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ms</span>
            </p>
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight leading-none text-slate-900 dark:text-white">—</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Incidents (24h)
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight leading-none whitespace-nowrap tabular-nums text-slate-900 dark:text-white">
            {snapshot.incidents24h}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/60 p-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Community reports
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight leading-none whitespace-nowrap tabular-nums text-slate-900 dark:text-white">
            {snapshot.communityReports !== null ? snapshot.communityReports : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Top incidents (last 24h)</p>
        {snapshot.recentIncidents.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No incidents reported in the last 24 hours.
          </p>
        ) : (
          <ul className="space-y-2">
            {snapshot.recentIncidents.map((incident) => {
              const providerId = incident.provider_id || (incident as any).providerId;
              const providerName = providerMap.get(providerId) || providerId || 'provider';
              const timestamp = incident.updated_at || incident.updatedAt;
              return (
                <li
                  key={incident.incident_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/60 dark:bg-slate-900/50 px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-white">{incident.title}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {providerName} • {formatTimeAgo(timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <Link
                      href={incident.permalink}
                      className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    >
                      Incident →
                    </Link>
                    <Link
                      href={`${incident.permalink}/cite`}
                      className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    >
                      Cite →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
