import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import NotifyInlineForm from '@/app/components/NotifyInlineForm';
import { getCasualStatus, listCasualApps } from '@/lib/services/casual';
import { getOpenGaps, getRecentCaughtEvents } from '@/lib/services/gap-detector';
import { searchIncidents } from '@/lib/services/public-data';
import { formatTimeAgo } from '@/lib/utils/time';
import {
  APP_LOGOS,
  VERDICT_COPY,
  VERDICT_ORDER,
  VERDICT_TONE,
  shortName,
  verdictKey,
} from '@/lib/ui/verdict';

export const revalidate = 60;

const DESCRIPTION =
  'Is ChatGPT down? Is Claude down? Live, plain-English status for the AI apps you use — checked with our own tests every few minutes, not just the official status pages.';

export const metadata: Metadata = {
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Is your AI down right now?',
    description: DESCRIPTION,
    images: ['https://aistatusdashboard.com/og/status-home.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Is your AI down right now?',
    description: DESCRIPTION,
    images: ['https://aistatusdashboard.com/og/status-home.svg'],
  },
};

export default async function HomePage() {
  const apps = listCasualApps();
  const sevenDaysAgoIso = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [statuses, incidentPayload, openGaps, caughtEvents] = await Promise.all([
    Promise.all(
      apps.map(async (app) => {
        const status = await getCasualStatus({ appId: app.id }).catch(() => null);
        return { app, status };
      })
    ),
    searchIncidents({ since: sevenDaysAgoIso, limit: 6 }).catch(() => ({ data: { incidents: [] } })),
    getOpenGaps(),
    getRecentCaughtEvents(3),
  ]);

  const gapProviders = new Set(openGaps.map((gap) => gap.providerId));
  const configOrder = new Map(apps.map((app, index) => [app.id, index]));
  const board = statuses
    .map(({ app, status }) => {
      const rawKey = status ? verdictKey(status.overall_status) : ('unknown' as const);
      // Our failing probes outrank a green official page.
      const key = gapProviders.has(app.providerId) && rawKey === 'up' ? ('wobbly' as const) : rawKey;
      return { app, status, key, name: shortName(app.id, app.label) };
    })
    .sort(
      (a, b) =>
        VERDICT_ORDER[a.key] - VERDICT_ORDER[b.key] ||
        (configOrder.get(a.app.id) ?? 99) - (configOrder.get(b.app.id) ?? 99)
    );

  const verified = board.filter((item) => item.status);
  const troubled = board.filter((item) => item.key === 'down' || item.key === 'wobbly');
  const updatedAt = verified
    .map((item) => item.status!.updated_at)
    .sort()
    .pop();

  const heroSentence = verified.length === 0
    ? 'Checking every AI service now…'
    : troubled.length === 0
      ? 'All quiet. Every AI we watch is up.'
      : troubled.length === 1
        ? VERDICT_COPY[troubled[0].key].sentence(troubled[0].name)
        : `${troubled.map((item) => item.name).slice(0, 3).join(', ')} ${troubled.length === 2 ? 'are' : 'and more are'} having issues.`;

  const heroTone = verified.length === 0
    ? 'text-slate-500 dark:text-slate-400'
    : troubled.some((item) => item.key === 'down')
      ? 'text-rose-600 dark:text-rose-400'
      : troubled.length
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400';

  const recentIncidents = (incidentPayload.data?.incidents || []).slice(0, 6);
  const providerIds = Array.from(new Set(board.map((item) => item.app.providerId)));

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* The answer, before anything else. */}
        <header className="pt-6 md:pt-10 text-center space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-2 align-middle" aria-hidden="true" />
            Live · checked {updatedAt ? formatTimeAgo(updatedAt) : 'just now'}
          </p>
          <h1 className={`text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight ${heroTone}`}>
            {heroSentence}
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            We don&apos;t just mirror the official status pages — we test these services ourselves,
            every few minutes, and we tell you when something is off before it&apos;s acknowledged.
          </p>
        </header>

        {/* The board. Troubled apps float to the top. */}
        <section aria-label="AI app status board" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {board.map(({ app, status, key, name }) => {
            const tone = VERDICT_TONE[key];
            const copy = VERDICT_COPY[key];
            return (
              <Link
                key={app.id}
                href={`/${app.id}`}
                className={`group rounded-2xl border bg-white/80 dark:bg-slate-900/70 p-4 flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-lg ${tone.card}`}
              >
                <Image
                  src={APP_LOGOS[app.id] || '/logos/openai.svg'}
                  alt=""
                  width={36}
                  height={36}
                  className="rounded-lg shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-slate-900 dark:text-white truncate">
                    {name}
                  </span>
                  <span className={`block text-sm font-medium ${tone.text}`}>{copy.label}</span>
                </span>
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${tone.dot} ${key !== 'up' ? 'animate-pulse' : ''}`} aria-hidden="true" />
              </Link>
            );
          })}
        </section>

        {/* One alert CTA for the whole page. */}
        <section id="alerts" className="surface-card-strong p-6 md:p-8 max-w-2xl mx-auto text-center space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Know the moment your AI breaks
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            One email when something goes down, one when it&apos;s back. Nothing else.
          </p>
          <NotifyInlineForm
            providerIds={providerIds}
            prompt=""
            ctaLabel="Alert me"
            className="space-y-2 max-w-md mx-auto"
          />
        </section>

        {/* What broke recently — social proof that we catch things. */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">This week&apos;s incidents</h2>
          {recentIncidents.length ? (
            <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70 surface-card">
              {recentIncidents.map((incident: any) => (
                <li key={incident.incident_id}>
                  <Link
                    href={incident.permalink}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white truncate">
                        {incident.title}
                      </span>
                      <span className="block font-mono text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {incident.providerId} · {formatTimeAgo(incident.updatedAt)}
                      </span>
                    </span>
                    <span className="text-slate-400 shrink-0" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300 surface-card p-4">
              A quiet week — no outages recorded in the last 7 days.{' '}
              <Link href="/incidents" className="underline">See the full history</Link>.
            </p>
          )}
          <Link href="/incidents" className="inline-block text-sm underline text-slate-700 dark:text-slate-200">
            All outage history →
          </Link>
        </section>

        {/* Receipts for the headline claim — only rendered when we have them. */}
        {caughtEvents.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Caught before it was announced</h2>
            <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70 surface-card">
              {caughtEvents.map((event) => (
                <li key={event.incidentId}>
                  <Link
                    href={`/incidents/${event.incidentId}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-white truncate">
                        {event.incidentTitle}
                      </span>
                      <span className="block font-mono text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                        our tests caught this {event.leadMinutes} min before it was acknowledged
                      </span>
                    </span>
                    <span className="text-slate-400 shrink-0" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Why trust this. */}
        <section className="grid gap-4 sm:grid-cols-3 text-sm">
          <div className="surface-card p-5">
            <p className="font-semibold text-slate-900 dark:text-white">We test it ourselves</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              Real requests to the services every few minutes — not just a copy of the official page.
            </p>
          </div>
          <div className="surface-card p-5">
            <p className="font-semibold text-slate-900 dark:text-white">People like you report in</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              One tap to say &ldquo;it&apos;s broken for me too&rdquo; — so you know if it&apos;s just you.
            </p>
          </div>
          <div className="surface-card p-5">
            <p className="font-semibold text-slate-900 dark:text-white">We say when we don&apos;t know</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              If we can&apos;t verify a service, we show &ldquo;checking&rdquo; — never a false green light.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
