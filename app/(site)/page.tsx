import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import NotifyInlineForm from '@/app/components/NotifyInlineForm';
import { getCasualStatus, getCasualApp } from '@/lib/services/casual';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';
import { getStatusSummary, searchIncidents } from '@/lib/services/public-data';
import { providerService } from '@/lib/services/providers';
import { formatTimeAgo } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  description:
    'Live status for ChatGPT, Claude, Gemini, and 15 other AI providers. Is your AI down? Check in 3 seconds.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'AI Status — is ChatGPT, Claude, or Gemini down right now?',
    description:
      'Live status for ChatGPT, Claude, Gemini, and 15 other AI providers. Is your AI down? Check in 3 seconds.',
    images: ['https://aistatusdashboard.com/og/status-home.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Status — is ChatGPT, Claude, or Gemini down right now?',
    description:
      'Live status for ChatGPT, Claude, Gemini, and 15 other AI providers. Is your AI down? Check in 3 seconds.',
    images: ['https://aistatusdashboard.com/og/status-home.svg'],
  },
};

const FOCUS_APPS = ['chatgpt', 'claude', 'gemini'] as const;
const LOGOS: Record<string, string> = {
  chatgpt: '/logos/openai-chatgpt.png',
  claude: '/logos/claude.svg',
  gemini: '/logos/google-ai.svg',
};

function summarizeStatus(status: string) {
  if (status === 'down') {
    return {
      headline: 'is having problems',
      tone: 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-100',
      pill: 'bg-rose-500',
      label: 'Down',
    };
  }
  if (status === 'degraded') {
    return {
      headline: 'is partially affected',
      tone: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100',
      pill: 'bg-amber-500',
      label: 'Degraded',
    };
  }
  return {
    headline: 'is working normally',
    tone: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100',
    pill: 'bg-emerald-500',
    label: 'Operational',
  };
}

function notifyCopy(status: string, providerName: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'operational') {
    return {
      prompt: `Get notified the next time ${providerName} has an issue`,
      cta: 'Notify me',
    };
  }
  if (normalized === 'resolved' || normalized === 'recovering') {
    return {
      prompt: `Notify me of future ${providerName} incidents`,
      cta: 'Notify me',
    };
  }
  return {
    prompt: 'Notify me when this is fixed',
    cta: 'Notify me',
  };
}

export default async function LandingPage() {
  const sevenDaysAgoIso = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [livePulse, statusSummary, incidentPayload] = await Promise.all([
    getLivePulseSnapshot(),
    getStatusSummary({ windowSeconds: 1800, lens: 'observed' }),
    searchIncidents({ since: sevenDaysAgoIso, limit: 8 }),
  ]);

  const appStatuses = await Promise.all(
    FOCUS_APPS.map(async (appId) => {
      const app = getCasualApp(appId);
      if (!app) return null;
      const status = await getCasualStatus({ appId: app.id });
      return app && status ? { app, status } : null;
    })
  );

  const providerRows = statusSummary.data.providers || [];
  const focusProviderIds = new Set(
    appStatuses
      .filter(Boolean)
      .map((item) => item!.app.providerId)
  );
  const providerLookup = new Map(providerRows.map((row: any) => [row.provider_id, row]));
  const secondaryProviders = providerService
    .getProviders()
    .filter((provider) => !focusProviderIds.has(provider.id))
    .map((provider) => ({
      provider,
      status: providerLookup.get(provider.id)?.status || 'unknown',
      app: getCasualApp(provider.id),
    }));

  const caughtEarly = (incidentPayload.data?.incidents || [])
    .map((incident: any) => {
      const started = Date.parse(incident.startedAt || '');
      const updated = Date.parse(incident.updatedAt || '');
      if (!Number.isFinite(started) || !Number.isFinite(updated) || updated <= started) return null;
      return {
        id: incident.incident_id,
        title: incident.title,
        providerId: incident.providerId,
        deltaMinutes: Math.round((updated - started) / 60000),
      };
    })
    .filter(Boolean)
    .slice(0, 5) as Array<{ id: string; title: string; providerId: string; deltaMinutes: number }>;

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="surface-card-strong p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Live AI status</p>
              <h1 className="mt-2 text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white">
                Is your AI working?
              </h1>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Fast answers for ChatGPT, Claude, and Gemini. Then drill into details only when needed.
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
              <div>Updated {formatTimeAgo(livePulse.lastUpdated)}</div>
              <div>Last check: {formatTimeAgo(livePulse.lastUpdated)}</div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {appStatuses.filter(Boolean).map((item) => {
            const app = item!.app;
            const status = item!.status;
            const tone = summarizeStatus(status.overall_status);
            const providerName = app.label.replace(' Status', '');
            const notify = notifyCopy(status.overall_status, providerName);
            return (
              <article
                key={app.id}
                className={`rounded-2xl border p-5 space-y-4 ${tone.tone}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Image src={LOGOS[app.id] || '/logos/openai.svg'} alt={`${app.label} logo`} width={28} height={28} />
                    <p className="text-lg font-semibold">{providerName}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/80 dark:bg-slate-900/70 px-2 py-1 text-xs border border-current/20">
                    <span className={`h-2 w-2 rounded-full ${tone.pill}`} aria-hidden="true" />
                    {tone.label}
                  </span>
                </div>

                <p className="text-base font-medium">
                  {providerName} {tone.headline}.
                </p>
                <p className="text-sm opacity-90">{status.is_it_just_me.note}</p>
                {status.history.last_similar_event ? (
                  <p className="text-xs opacity-80">
                    Recent: {status.history.last_similar_event.title}
                  </p>
                ) : null}

                <NotifyInlineForm
                  providerIds={[app.providerId]}
                  prompt={notify.prompt}
                  ctaLabel={notify.cta}
                />
                <Link
                  href={`/casual/${app.id}`}
                  className="inline-block text-sm underline"
                >
                  See details →
                </Link>
              </article>
            );
          })}
        </section>

        <section className="surface-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Other providers</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {secondaryProviders.map(({ provider, status, app }) => {
              const tone = summarizeStatus(status);
              return (
                <Link
                  key={provider.id}
                  href={app ? `/casual/${app.id}` : `/provider/${provider.id}`}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs bg-white/80 dark:bg-slate-900/60"
                >
                  <span className={`h-2 w-2 rounded-full ${tone.pill}`} aria-hidden="true" />
                  {provider.displayName || provider.name}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="surface-card p-5">
          <Link className="text-sm underline" href="/developer">
            Developer? Use the API / MCP / Datasets →
          </Link>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Caught early</h2>
          {caughtEarly.length ? (
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {caughtEarly.map((item) => (
                <li key={item.id}>
                  {item.title} ({item.providerId}) · detected {item.deltaMinutes} min before full update window closed.
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No verified pre-acknowledgement detections are published yet.
            </p>
          )}
        </section>

        <noscript>
          <div className="surface-card p-4 text-sm">
            Open the full interactive report:
            {' '}
            <Link className="underline" href="/casual/chatgpt">
              /casual/chatgpt
            </Link>
          </div>
        </noscript>
      </div>
    </main>
  );
}
