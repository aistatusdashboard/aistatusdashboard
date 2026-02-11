import type { Metadata } from 'next';
import Link from 'next/link';
import { statusService } from '@/lib/services/status';
import { intelligenceService } from '@/lib/services/intelligence';
import { queryMetricSeries, type MetricName, type MetricSeries } from '@/lib/services/metrics';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';
import { log } from '@/lib/utils/logger';
import sourcesConfig from '@/lib/data/sources.json';
import providersData from '@/lib/data/providers.json';
import type { NormalizedComponent, NormalizedIncident, NormalizedMaintenance } from '@/lib/types/ingestion';
import type { Provider } from '@/lib/types';
import type { ProviderCatalog } from '@/lib/services/public-data';
import { headers } from 'next/headers';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const sourcePolls = new Map<string, number>();
(sourcesConfig as { sources?: Array<{ providerId?: string; pollIntervalSeconds?: number }> }).sources?.forEach(
  (source) => {
    if (!source.providerId || typeof source.pollIntervalSeconds !== 'number') return;
    const current = sourcePolls.get(source.providerId);
    sourcePolls.set(
      source.providerId,
      typeof current === 'number' ? Math.min(current, source.pollIntervalSeconds) : source.pollIntervalSeconds
    );
  }
);

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatLatency(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return `${Math.round(value)}ms`;
}

function latestMetricValue(series: { series: Array<{ value: number | null }> }) {
  for (let i = series.series.length - 1; i >= 0; i -= 1) {
    const value = series.series[i].value;
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function emptySeries(metric: MetricName, providerId: string, since: Date, until: Date): MetricSeries {
  return {
    metric,
    provider_id: providerId,
    since: since.toISOString(),
    until: until.toISOString(),
    granularity_seconds: 300,
    series: [],
  };
}

type ProviderParams = { id: string | string[] };

async function resolveParams(params: ProviderParams | Promise<ProviderParams>) {
  return Promise.resolve(params);
}

function extractProviderId(path?: string | null) {
  if (!path) return undefined;
  const match = path.match(/\/provider\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : undefined;
}

async function resolveProviderId(idInput: string | string[] | undefined) {
  const id = Array.isArray(idInput) ? idInput[0] : idInput;
  if (id) return id;
  const headerList = await headers();
  const fallbackPath =
    headerList.get('x-forwarded-uri') ||
    headerList.get('x-original-url') ||
    headerList.get('x-url') ||
    headerList.get('x-rewrite-url') ||
    headerList.get('x-invoke-path');
  const extracted = extractProviderId(fallbackPath);
  if (!extracted) {
    log('warn', 'Provider param missing', {
      fallbackPath,
      headerSample: Array.from(headerList.keys()).slice(0, 8),
    });
  }
  return extracted;
}

async function fetchProviderFromApi(providerId: string): Promise<Provider | undefined> {
  try {
    const response = await fetch(`${SITE_URL}/api/public/v1/providers`, { cache: 'no-store' });
    if (!response.ok) return undefined;
    const payload = await response.json();
    const candidates = (payload?.data || []) as ProviderCatalog[];
    const match = candidates.find((provider) => provider.id === providerId);
    if (!match) return undefined;
    const statusUrl = match.status_url || match.status_page_url || '';
    return {
      id: match.id,
      name: match.name,
      displayName: match.display_name || match.name,
      statusUrl,
      statusPageUrl: match.status_page_url || statusUrl,
      category: match.category || 'Unknown',
    };
  } catch (error) {
    log('warn', 'Provider lookup via API failed', { providerId, error });
    return undefined;
  }
}

const catalogProviders = (providersData as { providers?: Provider[] }).providers
  ?.filter((provider) => provider.enabled !== false) || [];

async function resolveProvider(idInput: string | string[] | undefined): Promise<Provider | undefined> {
  const id = await resolveProviderId(idInput);
  if (!id) return undefined;
  const normalized = id.toLowerCase();
  const fallback = catalogProviders.find((provider) => {
    if (provider.id?.toLowerCase() === normalized) return true;
    const aliases = provider.aliases || [];
    return aliases.some((alias) => alias.toLowerCase() === normalized);
  });
  if (fallback) return fallback;
  const apiFallback = await fetchProviderFromApi(id);
  if (apiFallback) return apiFallback;
  {
    log('warn', 'Provider lookup failed', {
      providerId: id,
      catalogSize: catalogProviders.length,
      sampleProviders: catalogProviders.slice(0, 5).map((provider) => provider.id),
    });
  }
  return undefined;
}

export async function generateMetadata({
  params,
}: {
  params: ProviderParams | Promise<ProviderParams>;
}): Promise<Metadata> {
  const resolvedParams = await resolveParams(params);
  const paramId = resolvedParams?.id;
  const provider = await resolveProvider(paramId);
  if (!provider) {
    const providerId = await resolveProviderId(paramId);
    const fallbackName = providerId ? providerId.replace(/-/g, ' ') : 'Provider';
    const canonical = providerId ? `/provider/${providerId}` : '/providers';
    return {
      title: `${fallbackName} Status`,
      description: `Live status, incidents, and uptime signals for ${fallbackName}.`,
      alternates: {
        canonical,
      },
    };
  }

  const displayName = provider.displayName || provider.name;
  const title = `${displayName} Status`;
  const description = `Live status, incidents, and uptime signals for ${displayName}.`;
  const url = `${SITE_URL}/provider/${provider.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: {
        'application/rss+xml': `${SITE_URL}/rss.xml?provider=${provider.id}`,
      },
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og.png'],
    },
  };
}

export default async function ProviderPage({
  params,
}: {
  params: ProviderParams | Promise<ProviderParams>;
}) {
  const resolvedParams = await resolveParams(params);
  const paramId = resolvedParams?.id;
  const provider = await resolveProvider(paramId);
  const providerId = await resolveProviderId(paramId);
  if (!provider) {
    const fallbackName = providerId ? providerId.replace(/-/g, ' ') : 'Provider';
    return (
      <main className="flex-1">
        <div className="px-4 sm:px-6 py-10">
          <div className="max-w-3xl mx-auto space-y-4">
            <section className="surface-card-strong p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Provider status
              </p>
              <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
                {fallbackName} status
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
                We could not load details for this provider yet. See the full provider list or use the
                public JSON endpoints below.
              </p>
            </section>

            <section className="surface-card p-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Provider ID:</span>{' '}
                {providerId || 'unknown'}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/providers" className="cta-secondary text-xs">Browse providers</Link>
                <Link href="/api/public/v1/providers" className="cta-secondary text-xs">Providers JSON</Link>
                <Link href="/api/public/v1/status/summary" className="cta-secondary text-xs">Status summary JSON</Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  const displayName = provider.displayName || provider.name;
  const baseStatus = await statusService.checkProvider(provider);

  let summaries: any[] = [];
  try {
    summaries = await intelligenceService.getProviderSummaries();
  } catch {
    summaries = [];
  }

  const summary = summaries.find((entry) => entry.providerId === provider.id);
  const pollSeconds = sourcePolls.get(provider.id) ?? 120;
  const updatedAt = summary?.lastUpdated ? Date.parse(summary.lastUpdated) : NaN;
  const baselineCheckedAt = baseStatus.lastChecked ? Date.parse(baseStatus.lastChecked) : NaN;
  const freshDeltaMs =
    Number.isFinite(updatedAt) && Number.isFinite(baselineCheckedAt)
      ? Math.abs(baselineCheckedAt - updatedAt)
      : Number.POSITIVE_INFINITY;
  const isFresh =
    Number.isFinite(updatedAt) && freshDeltaMs <= pollSeconds * 2 * 1000 + 60000;
  const hasEvidence =
    (summary?.activeIncidentCount || 0) > 0 ||
    (summary?.activeMaintenanceCount || 0) > 0 ||
    (summary?.degradedComponentCount || 0) > 0;
  const useSummary = summary?.status && summary.status !== 'unknown' && hasEvidence && isFresh;

  const mergedStatus = useSummary ? summary.status : baseStatus.status;
  const lastUpdated = useSummary ? summary.lastUpdated || baseStatus.lastChecked : baseStatus.lastChecked;
  const officialStatusUrl = provider.statusPageUrl || provider.statusUrl;

  let detail: {
    components: NormalizedComponent[];
    incidents: NormalizedIncident[];
    maintenances: NormalizedMaintenance[];
  } = { components: [], incidents: [], maintenances: [] };
  try {
    detail = await intelligenceService.getProviderDetail(provider.id);
  } catch (error) {
    log('warn', 'Provider detail load failed', { providerId: provider.id, error });
  }
  const incidents = detail.incidents
    .map(normalizeIncidentDates)
    .filter((incident) => incident.status !== 'resolved')
    .slice(0, 5);

  const now = new Date();
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  let p50Series = emptySeries('latency_p50_ms', provider.id, since, now);
  let p95Series = emptySeries('latency_p95_ms', provider.id, since, now);
  let p99Series = emptySeries('latency_p99_ms', provider.id, since, now);
  try {
    [p50Series, p95Series, p99Series] = await Promise.all([
      queryMetricSeries({
        metric: 'latency_p50_ms',
        providerId: provider.id,
        since,
        until: now,
        granularitySeconds: 300,
      }),
      queryMetricSeries({
        metric: 'latency_p95_ms',
        providerId: provider.id,
        since,
        until: now,
        granularitySeconds: 300,
      }),
      queryMetricSeries({
        metric: 'latency_p99_ms',
        providerId: provider.id,
        since,
        until: now,
        granularitySeconds: 300,
      }),
    ]);
  } catch {
    // Fallback to empty series if metrics lookups fail at runtime.
  }

  const latencySnapshot = {
    p50: latestMetricValue(p50Series),
    p95: latestMetricValue(p95Series),
    p99: latestMetricValue(p99Series),
  };

  const evidenceSummaryUrl = `${SITE_URL}/api/public/v1/status/summary?provider=${provider.id}`;
  const evidenceIncidentsUrl = `${SITE_URL}/api/public/v1/incidents?provider=${provider.id}&limit=5`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${displayName} Status`,
    serviceType: 'Status Monitoring',
    provider: {
      '@type': 'Organization',
      name: provider.name,
      url: provider.statusPageUrl,
    },
    url: `${SITE_URL}/provider/${provider.id}`,
  };

  const appJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AI Status Dashboard',
    applicationCategory: 'WebApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}/provider/${provider.id}`,
    description: `Provider status, incidents, and uptime signals for ${displayName}.`,
  };

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <section className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Provider status
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              {displayName} status
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Live availability signals, recent incidents, and official status references for {displayName}.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {mergedStatus}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Last updated {formatDate(lastUpdated)}
              </span>
              <a
                href={officialStatusUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-white"
              >
                Official status page
              </a>
              <a
                href={`/rss.xml?provider=${provider.id}`}
                className="text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-white"
              >
                RSS feed
              </a>
            </div>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Performance snapshot</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Latency percentiles based on the last 60 minutes of probes and telemetry.
            </p>
            <div className="grid gap-4 sm:grid-cols-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">p50 latency</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatLatency(latencySnapshot.p50)}</p>
              </div>
              <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">p95 latency</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatLatency(latencySnapshot.p95)}</p>
              </div>
              <div className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">p99 latency</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatLatency(latencySnapshot.p99)}</p>
              </div>
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recent incidents</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Active or recently reported incidents pulled from official sources and normalized feeds.
            </p>
            <div className="mt-4 space-y-3">
              {incidents.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No active incidents reported in the current window.
                </p>
              ) : (
                incidents.map((incident) => (
                  <div key={incident.id} className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{incident.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Started {formatDate(incident.startedAt)}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                        {incident.severity}
                      </span>
                    </div>
                    {incident.rawUrl && (
                      <a
                        href={incident.rawUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-600 dark:text-slate-300 underline hover:text-slate-900 dark:hover:text-white mt-2 inline-block"
                      >
                        View official update
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How we verify</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              We combine official status updates, normalized incident feeds, and synthetic probes to detect
              disruptions early. If signals are uncertain, we default to operational and show an advisory note
              rather than issuing a false alert.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/how-it-works" className="cta-secondary text-xs">
                Methodology
              </Link>
              <Link href="/providers" className="cta-secondary text-xs">
                Browse all providers
              </Link>
            </div>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cite this provider</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>Canonical: {`${SITE_URL}/provider/${provider.id}`}</li>
              <li>Last updated: {formatDate(lastUpdated)}</li>
              <li>
                Official status:{' '}
                {officialStatusUrl ? (
                  <a className="underline" href={officialStatusUrl} target="_blank" rel="noopener noreferrer">
                    {officialStatusUrl}
                  </a>
                ) : (
                  'n/a'
                )}
              </li>
              <li>
                Evidence: {evidenceSummaryUrl}
              </li>
              <li>
                Incidents: {evidenceIncidentsUrl}
              </li>
            </ul>
          </section>

          <noscript>
            <div className="surface-card p-4">
              <p>Provider snapshot: /api/public/v1/status/summary and /api/public/v1/incidents</p>
            </div>
          </noscript>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([structuredData, appJsonLd]) }}
      />
    </main>
  );
}
