import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCasualApp, getCasualStatus } from '@/lib/services/casual';
import CasualReportPanel from '../ui/CasualReportPanel';
import CasualShareButton from '../ui/CasualShareButton';
import CasualHelpful from '../ui/CasualHelpful';

type CasualParams = { appId: string };

export async function generateMetadata({ params }: { params: Promise<CasualParams> }): Promise<Metadata> {
  const { appId } = await params;
  const app = getCasualApp(appId);
  if (!app) return { title: 'Status' };
  return {
    title: `${app.label} | AI Status Dashboard`,
    description: `Plain-English status for ${app.label.replace(' Status', '')}: symptoms, guidance, and recovery expectations.`,
    alternates: { canonical: `/casual/${app.id}` },
  };
}

function statusTone(status: string) {
  switch (status) {
    case 'down':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'degraded':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
}

export default async function CasualAppPage({ params }: { params: Promise<CasualParams> }) {
  const { appId } = await params;
  const app = getCasualApp(appId);
  if (!app) return notFound();

  const status = await getCasualStatus({ appId: app.id });
  if (!status) return notFound();

  const updatedMinutes = Math.max(1, Math.round((Date.now() - Date.parse(status.updated_at)) / 60000));
  const typical = status.history.typical_resolution_minutes
    ? `Usually resolves in ~${status.history.typical_resolution_minutes} min.`
    : 'Resolution time varies; we will update as we learn more.';

  const reportSummary = status.is_it_just_me;
  const reportLabel = reportSummary.likely_global
    ? 'Likely global'
    : reportSummary.reports === 0
      ? 'Likely local'
      : 'Mixed signals';

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Casual Mode</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">{app.label}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Plain-English status for {app.label.replace(' Status', '')}. Updated {updatedMinutes} min ago.
            </p>
          </header>

          <section className="surface-card-strong p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-xs uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${statusTone(status.overall_status)}`}>
                {status.overall_status}
              </span>
              <span className="text-xs text-slate-500">Last updated {updatedMinutes} min ago</span>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{status.headline}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">What you may feel</p>
                <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
                  {status.symptoms.map((symptom) => (
                    <li key={symptom}>{symptom}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">What to do now</p>
                <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
                  {status.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span>{typical}</span>
              {status.history.last_similar_event && (
                <Link href={status.history.last_similar_event.url} className="text-slate-700 dark:text-slate-200 underline">
                  Similar issue: {status.history.last_similar_event.title}
                </Link>
              )}
            </div>
            <CasualShareButton
              summary={`[${status.overall_status.toUpperCase()}] ${app.label.replace(' Status', '')}: ${status.headline} ${status.history.typical_resolution_minutes ? `Usually resolves ~${status.history.typical_resolution_minutes}m.` : 'Resolution time varies.'} aistatusdashboard.com/casual/${app.id}`}
            />
            <CasualHelpful appId={app.id} />
          </section>

          <section className="surface-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Is it just me?</p>
                <p className="text-xs text-slate-500">{reportSummary.reports} reports in the last {reportSummary.window_minutes} minutes</p>
              </div>
              <span className={`px-3 py-1 text-xs rounded-full border ${statusTone(reportSummary.likely_global ? 'degraded' : 'operational')}`}>
                {reportLabel}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{reportSummary.note}</p>
            {reportSummary.top_regions.length > 0 && (
              <div className="text-xs text-slate-500">
                More reports from: {reportSummary.top_regions.map((r) => `${r.region} (${r.count})`).join(', ')}
              </div>
            )}
            <CasualReportPanel appId={app.id} surfaces={status.surfaces} />
            <details className="text-sm text-slate-600 dark:text-slate-300">
              <summary className="cursor-pointer text-slate-700 dark:text-slate-200">Quick checks</summary>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Refresh once and wait a few minutes.</li>
                <li>Try another browser or device.</li>
                <li>Sign out and back in if sessions look stuck.</li>
                <li>Check your network or VPN settings.</li>
              </ul>
            </details>
          </section>

          <section className="surface-card-strong p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Surface health</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {status.surfaces.map((surface) => (
                <div key={surface.id} className="surface-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{surface.label}</p>
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusTone(surface.status)}`}>
                      {surface.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{surface.headline}</p>
                  <div className="text-xs text-slate-500">Confidence: {(surface.confidence * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card p-6">
            <details>
              <summary className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">Why we think this</summary>
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>We are looking at official incidents, synthetic probes, and anonymous user reports.</p>
                <ul className="list-disc list-inside">
                  {status.evidence.map((item) => (
                    <li key={`${item.type}-${item.url}`}>
                      <a className="underline" href={item.url}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </section>
        </div>
      </div>
    </main>
  );
}
