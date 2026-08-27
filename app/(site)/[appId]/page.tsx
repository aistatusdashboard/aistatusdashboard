import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getCasualApp, getCasualStatus, listCasualApps } from '@/lib/services/casual';
import { getProbeReceipt } from '@/lib/services/probe-receipt';
import { getOpenGap } from '@/lib/services/gap-detector';
import NotifyInlineForm from '@/app/components/NotifyInlineForm';
import CasualReportPanel from '@/app/components/casual/CasualReportPanel';
import CasualShareButton from '@/app/components/casual/CasualShareButton';
import CasualHelpful from '@/app/components/casual/CasualHelpful';
import { formatTimeAgo } from '@/lib/utils/time';
import {
  APP_LOGOS,
  VERDICT_COPY,
  VERDICT_TONE,
  shortName,
  verdictKey,
} from '@/lib/ui/verdict';

type AppParams = { appId: string };

export const revalidate = 60;
export const dynamicParams = false;

export function generateStaticParams() {
  return listCasualApps().map((app) => ({ appId: app.id }));
}

export async function generateMetadata({ params }: { params: Promise<AppParams> }): Promise<Metadata> {
  const { appId } = await params;
  const app = getCasualApp(appId);
  if (!app) return { title: 'Status' };
  const name = shortName(app.id, app.label);
  const title = `Is ${name} down? Live status`;
  const description = `Is ${name} down right now, or is it just you? Live status from our own tests, official incident reports, and user reports — in plain English.`;
  return {
    title,
    description,
    alternates: { canonical: `/${app.id}` },
    openGraph: {
      title,
      description,
      images: [`https://aistatusdashboard.com/og/app/${app.id}`],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`https://aistatusdashboard.com/og/app/${app.id}`],
    },
  };
}

export default async function AppStatusPage({ params }: { params: Promise<AppParams> }) {
  const { appId } = await params;
  const app = getCasualApp(appId);
  if (!app) return notFound();

  const [status, receipt, openGap] = await Promise.all([
    getCasualStatus({ appId: app.id }).catch(() => null),
    getProbeReceipt(app.providerId),
    getOpenGap(app.providerId),
  ]);
  const name = shortName(app.id, app.label);

  if (!status) {
    // Data layer unreachable (e.g. build-time prerender): render an honest
    // "checking" shell; ISR replaces it within a minute at runtime.
    return (
      <main className="flex-1 px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto pt-6 text-center space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
            Is {name} down?
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-500 dark:text-slate-400">
            Checking {name} now…
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Refresh in a few seconds for a live verdict.
          </p>
        </div>
      </main>
    );
  }

  // An open gap (our probes failing, official page still green) outranks a
  // green official verdict — that's the whole point of testing independently.
  const rawKey = verdictKey(status.overall_status);
  const key = openGap && rawKey === 'up' ? 'wobbly' : rawKey;
  const tone = VERDICT_TONE[key];

  const answer =
    key === 'down'
      ? `Yes — ${name} looks down.`
      : key === 'wobbly'
        ? `Sort of — ${name} is having issues.`
        : key === 'unknown'
          ? `We can't verify ${name} right now.`
          : `No — ${name} is up.`;

  const reports = status.is_it_just_me;
  const typicalResolution = status.history.typical_resolution_minutes;
  const lastSimilar = status.history.last_similar_event;

  // "What's still working" — the thing you actually want mid-outage.
  const otherApps = listCasualApps().filter((item) => item.id !== app.id);
  const alternatives = (
    await Promise.all(
      otherApps.map(async (item) => {
        const s = await getCasualStatus({ appId: item.id }).catch(() => null);
        return s && verdictKey(s.overall_status) === 'up'
          ? { id: item.id, name: shortName(item.id, item.label) }
          : null;
      })
    )
  )
    .filter(Boolean)
    .slice(0, 4) as Array<{ id: string; name: string }>;

  const troubledSurfaces = status.surfaces.filter((s) => s.status !== 'operational');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Is ${name} down right now?`,
        acceptedAnswer: { '@type': 'Answer', text: `${answer} ${status.headline}` },
      },
    ],
  };

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto space-y-10">
        {/* The answer. */}
        <header className="pt-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Image src={APP_LOGOS[app.id] || '/logos/openai.svg'} alt="" width={32} height={32} priority className="rounded-lg" />
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              Is {name} down?
            </p>
          </div>
          <h1 className={`text-4xl sm:text-5xl font-bold tracking-tight ${tone.text}`}>{answer}</h1>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
            <span className={`inline-block h-2 w-2 rounded-full mr-2 align-middle ${tone.dot} ${key !== 'up' ? 'animate-pulse' : ''}`} aria-hidden="true" />
            checked {formatTimeAgo(status.updated_at)} · {reports.reports} user report{reports.reports === 1 ? '' : 's'} in the last {reports.window_minutes} min
          </p>
          {key !== 'up' && (
            <p className="text-base text-slate-700 dark:text-slate-200 max-w-xl mx-auto">{status.headline}</p>
          )}
        </header>

        {/* Caught it first: our probes disagree with the official page. */}
        {openGap && (
          <section className="rounded-2xl border border-amber-300/80 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-5 space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
              Not yet acknowledged
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Our live tests have failed {openGap.failCount} times in a row since{' '}
              {formatTimeAgo(openGap.startedAt)}
              {openGap.lastErrorCode ? ` (${openGap.lastErrorCode})` : ''}, but{' '}
              {app.providerDisplay}&apos;s official status page still says operational. You may be
              seeing this before it&apos;s announced.
            </p>
          </section>
        )}

        {/* The receipt: proof we actually tested it, plus a citable plain-text answer. */}
        <section className="surface-card p-5 space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {receipt?.kind === 'real' ? 'Last independent test' : 'Last check'}
          </p>
          {receipt ? (
            <>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {formatTimeAgo(receipt.at)} —{' '}
                {receipt.kind === 'real'
                  ? receipt.ok
                    ? `we sent ${app.providerDisplay} a real request; it answered in ${(receipt.latencyMs / 1000).toFixed(1)}s`
                    : `we sent ${app.providerDisplay} a real request; it returned an error (${receipt.errorCode})`
                  : receipt.ok
                    ? `we read ${app.providerDisplay}'s official status feed in ${receipt.latencyMs}ms`
                    : `we could not read ${app.providerDisplay}'s official status feed (${receipt.errorCode})`}{' '}
                <span className={receipt.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} aria-hidden="true">
                  {receipt.ok ? '✓' : '✗'}
                </span>
              </p>
              <div className="flex items-end gap-[2px]" aria-label={`Test results over the last 24 hours: ${receipt.ticks.filter((t) => t.ok).length} of ${receipt.ticks.length} passed`}>
                {receipt.ticks.map((tick) => (
                  <span
                    key={tick.at}
                    className={`h-3 w-1 rounded-sm ${tick.ok ? 'bg-emerald-400/80' : 'bg-rose-500'}`}
                    title={`${new Date(tick.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC — ${tick.ok ? 'OK' : 'failed'}`}
                  />
                ))}
                <span className="ml-2 font-mono text-[10px] text-slate-400 dark:text-slate-500">24h</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No test results recorded in the last 24 hours.
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/70 dark:border-slate-700/60 pt-3">
            As of{' '}
            {new Date(status.updated_at).toLocaleString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'UTC',
            })}{' '}
            UTC on{' '}
            {new Date(status.updated_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'UTC',
            })}
            , {name} is{' '}
            {key === 'up' ? 'operational' : key === 'wobbly' ? 'having issues' : key === 'down' ? 'experiencing an outage' : 'unverified'}
            {receipt
              ? ` — our last ${receipt.kind === 'real' ? 'independent test' : 'check'} ${receipt.ok ? 'succeeded' : 'failed'} ${formatTimeAgo(receipt.at)}.`
              : '.'}
          </p>
        </section>

        {/* Is it just me? */}
        <section className="surface-card-strong p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Is it just you?</h2>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${reports.likely_global ? VERDICT_TONE.wobbly.badge : VERDICT_TONE.up.badge}`}>
              {reports.likely_global ? 'Others are reporting problems too' : 'Probably just you'}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">{reports.note}</p>
          <CasualReportPanel appId={app.id} surfaces={status.surfaces} />
        </section>

        {/* What's off, what to do. */}
        {key !== 'up' && (
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="surface-card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">What you might be seeing</h2>
              <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
                {status.symptoms.map((symptom) => (
                  <li key={symptom}>{symptom}</li>
                ))}
              </ul>
              {troubledSurfaces.length > 0 && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Affected: {troubledSurfaces.map((s) => s.label).join(', ')}
                </p>
              )}
            </div>
            <div className="surface-card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">What you can do now</h2>
              <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 list-disc list-inside space-y-1">
                {status.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* When will it be back + alternatives. */}
        {key !== 'up' && (
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="surface-card p-5">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Outages like this usually last
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {typicalResolution ? `~${typicalResolution} min` : 'Hard to say yet'}
              </p>
              {lastSimilar && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Last time: {lastSimilar.title} — back in {lastSimilar.duration_minutes || '?'} min.
                </p>
              )}
            </div>
            <div className="surface-card p-5">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Working right now
              </p>
              {alternatives.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {alternatives.map((item) => (
                    <Link
                      key={item.id}
                      href={`/${item.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-300"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Nothing we can confidently recommend right now.
                </p>
              )}
            </div>
          </section>
        )}

        {/* The one CTA. */}
        <section id="alerts" className="surface-card-strong p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {key === 'up'
              ? `Get an email the next time ${name} breaks`
              : `Get an email when ${name} is back`}
          </h2>
          <NotifyInlineForm
            providerIds={[app.providerId]}
            prompt=""
            ctaLabel="Alert me"
            className="space-y-2 max-w-md mx-auto"
          />
        </section>

        <section className="flex flex-wrap items-center justify-center gap-4">
          <CasualShareButton
            summary={`${answer} ${status.headline} — via https://aistatusdashboard.com/${app.id}`}
          />
          <CasualHelpful appId={app.id} />
        </section>

        {/* Receipts. */}
        <section className="surface-card p-5">
          <details>
            <summary className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
              How we know
            </summary>
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <p>
                This verdict combines three signals: {app.providerDisplay}&apos;s official incident
                feed, our own live tests against the service, and reports from people on this page.
              </p>
              {status.evidence.length > 0 && (
                <ul className="list-disc list-inside">
                  {status.evidence.map((item) => (
                    <li key={`${item.type}-${item.url}`}>
                      <a className="underline" href={item.url} rel="noopener noreferrer">
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p>
                <Link href="/how-it-works" className="underline">More on how this works →</Link>
              </p>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
