import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCasualApp, getCasualStatus } from '@/lib/services/casual';
import { intelligenceService } from '@/lib/services/intelligence';
import NotifyInlineForm from '@/app/components/NotifyInlineForm';
import CasualReportPanel from '../ui/CasualReportPanel';
import CasualShareButton from '../ui/CasualShareButton';
import CasualHelpful from '../ui/CasualHelpful';

type CasualParams = { appId: string };

function displayName(appId: string, label: string) {
  if (appId === 'chatgpt') return 'ChatGPT';
  if (appId === 'claude') return 'Claude';
  if (appId === 'gemini') return 'Gemini';
  return label.replace(' Status', '');
}

export async function generateMetadata({ params }: { params: Promise<CasualParams> }): Promise<Metadata> {
  const { appId } = await params;
  const app = getCasualApp(appId);
  if (!app) return { title: 'Status' };
  const name = displayName(app.id, app.label);
  return {
    title: `Is ${name} down? Live status — AIStatusDashboard`,
    description: `Is ${name} down right now? Live status, incident context, and next actions.`,
    alternates: { canonical: `/casual/${app.id}` },
    openGraph: {
      title: `Is ${name} down? Live status — AIStatusDashboard`,
      description: `Live ${name} status with plain-English guidance and incident context.`,
      images: [`https://aistatusdashboard.com/og/casual/${app.id}.svg`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Is ${name} down? Live status — AIStatusDashboard`,
      description: `Live ${name} status with plain-English guidance and incident context.`,
      images: [`https://aistatusdashboard.com/og/casual/${app.id}.svg`],
    },
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

  const name = displayName(app.id, app.label);
  const updatedAt = new Date(status.updated_at);
  const updatedLabel = Number.isNaN(updatedAt.getTime())
    ? status.updated_at
    : updatedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const providerHistory = await intelligenceService.getIncidents({ providerId: app.providerId, limit: 90 });
  const similarCount = providerHistory.filter((incident) => Boolean(incident.resolvedAt)).length;
  const typicalResolution = status.history.typical_resolution_minutes;

  const alternatives = [
    { id: 'chatgpt', name: 'ChatGPT' },
    { id: 'claude', name: 'Claude' },
    { id: 'gemini', name: 'Gemini' },
  ].filter((item) => item.id !== app.id);

  const actionableOutage = status.overall_status === 'down' || status.overall_status === 'degraded';

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Casual Mode</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">
              Is {name} down right now?
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              {status.headline} Updated {updatedLabel}.
            </p>
          </header>

          <section className="surface-card-strong p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`text-xs uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${statusTone(status.overall_status)}`}>
                {status.overall_status}
              </span>
              <span className="text-xs text-slate-500">Last updated {updatedLabel}</span>
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

            <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Typical resolution time
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                {typicalResolution ? `~${typicalResolution} min` : 'Not enough data yet'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Based on {similarCount} similar incidents in the last 90 days.
              </p>
            </div>

            <CasualShareButton
              summary={`[${status.overall_status.toUpperCase()}] ${name}: ${status.headline} ${
                typicalResolution ? `Typical resolution ~${typicalResolution}m.` : ''
              } https://aistatusdashboard.com/casual/${app.id}`}
            />
            <CasualHelpful appId={app.id} />
          </section>

          {actionableOutage ? (
            <section className="surface-card p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">What to do now</h3>
              <NotifyInlineForm providerIds={[app.providerId]} />
              <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                <p>Try a working alternative:</p>
                <div className="flex flex-wrap gap-3">
                  {alternatives.map((item) => (
                    <Link key={item.id} href={`/casual/${item.id}`} className="underline">
                      {item.name}
                    </Link>
                  ))}
                </div>
                <p>
                  Need fallback policy details?{' '}
                  <Link href="/developer" className="underline">
                    Open fallback API guidance →
                  </Link>
                </p>
              </div>
            </section>
          ) : null}

          <section className="surface-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Is it just me?</p>
                <p className="text-xs text-slate-500">
                  {status.is_it_just_me.reports} reports in the last {status.is_it_just_me.window_minutes} minutes
                </p>
              </div>
              <span className={`px-3 py-1 text-xs rounded-full border ${statusTone(status.is_it_just_me.likely_global ? 'degraded' : 'operational')}`}>
                {status.is_it_just_me.likely_global ? 'Likely global' : 'Likely local'}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">{status.is_it_just_me.note}</p>
            {status.is_it_just_me.top_regions.length > 0 && (
              <div className="text-xs text-slate-500">
                More reports from: {status.is_it_just_me.top_regions.map((r) => `${r.region} (${r.count})`).join(', ')}
              </div>
            )}
            <CasualReportPanel appId={app.id} surfaces={status.surfaces} />
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
                  <details className="text-xs text-slate-500 dark:text-slate-400">
                    <summary className="cursor-pointer">Why this number</summary>
                    Confidence: {(surface.confidence * 100).toFixed(0)}%
                  </details>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card p-6">
            <details>
              <summary className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">Why we think this</summary>
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p>We combine official incidents, synthetic probes, and anonymous user reports.</p>
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

          <section className="text-sm">
            <Link href="/embed" className="underline">
              Embed this on your site →
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
