import type { Metadata } from 'next';
import { intelligenceService } from '@/lib/services/intelligence';
import { listProviders } from '@/lib/services/public-data';
import { queryMetricSeries } from '@/lib/services/metrics';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';

export const metadata: Metadata = {
  title: 'Datasets',
  description: 'Public datasets for incidents and metrics from AIStatusDashboard.',
  alternates: {
    canonical: '/datasets',
  },
};

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DatasetsPage() {
  const now = new Date();
  const incidents = (await intelligenceService.getIncidents({ limit: 200 })).map(normalizeIncidentDates);
  const incidentLines = incidents.map((incident) =>
    JSON.stringify({
      incident_id: `${incident.providerId}:${incident.id}`,
      provider_id: incident.providerId,
      title: incident.title,
      status: incident.status,
      severity: incident.severity,
      started_at: incident.startedAt,
      updated_at: incident.updatedAt,
      resolved_at: incident.resolvedAt || null,
      impacted_regions: incident.impactedRegions || [],
      impacted_models: incident.impactedModels || [],
      raw_url: incident.rawUrl || null,
      source_id: incident.sourceId,
      service_id: incident.serviceId || null,
      service_name: incident.serviceName || null,
      updates: incident.updates || [],
    })
  );
  const incidentBytes = Buffer.byteLength(incidentLines.join('\n'), 'utf8');
  const incidentRows = incidents.length;
  const incidentUpdatedAt = incidents[0]?.updatedAt || now.toISOString();

  const providers = listProviders().slice(0, 6);
  const until = new Date();
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  const metricRows: string[] = ['timestamp,provider_id,metric,value,sample_count,sources'];

  for (const provider of providers) {
    const series = await queryMetricSeries({
      metric: 'latency_p95_ms',
      providerId: provider.id,
      since,
      until,
      granularitySeconds: 3600,
    });
    series.series.forEach((point) => {
      metricRows.push(
        [
          point.timestamp,
          provider.id,
          'latency_p95_ms',
          point.value === null ? '' : point.value,
          point.sample_count,
          point.sources.join('|'),
        ].join(',')
      );
    });
  }
  const metricsBytes = Buffer.byteLength(metricRows.join('\n'), 'utf8');
  const metricsRows = Math.max(metricRows.length - 1, 0);
  const metricsUpdatedAt = until;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DataCatalog',
    name: 'AIStatusDashboard Data Catalog',
    url: `${SITE_URL}/datasets`,
    description: 'Public incident and metrics datasets from AIStatusDashboard.',
    dataset: [
      {
        '@type': 'Dataset',
        name: 'AIStatusDashboard Incidents',
        url: `${SITE_URL}/datasets/incidents`,
        description: 'Normalized incident feed across AI providers.',
        temporalCoverage: '2024-01-01/2025-12-31',
        distribution: [
          {
            '@type': 'DataDownload',
            encodingFormat: 'application/x-ndjson',
            contentUrl: `${SITE_URL}/datasets/incidents.ndjson`,
          },
        ],
      },
      {
        '@type': 'Dataset',
        name: 'AIStatusDashboard Metrics',
        url: `${SITE_URL}/datasets/metrics`,
        description: 'Aggregated latency and reliability metrics.',
        temporalCoverage: '2024-01-01/2025-12-31',
        distribution: [
          {
            '@type': 'DataDownload',
            encodingFormat: 'text/csv',
            contentUrl: `${SITE_URL}/datasets/metrics.csv`,
          },
        ],
      },
    ],
  };

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Data Catalog
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Public datasets
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Machine-readable datasets with schema.org metadata.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Incidents</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Normalized incidents across AI providers.
            </p>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <li>Rows: {incidentRows}</li>
              <li>Download size: {formatBytes(incidentBytes)}</li>
              <li>Updated: {new Date(incidentUpdatedAt).toLocaleString('en-US')}</li>
            </ul>
            <a href="/datasets/incidents" className="cta-secondary text-xs">View incidents dataset</a>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Metrics</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Aggregated latency and reliability metrics.
            </p>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <li>Rows: {metricsRows}</li>
              <li>Download size: {formatBytes(metricsBytes)}</li>
              <li>Updated: {metricsUpdatedAt.toLocaleString('en-US')}</li>
            </ul>
            <a href="/datasets/metrics" className="cta-secondary text-xs">View metrics dataset</a>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cite this catalog</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>Canonical: {`${SITE_URL}/datasets`}</li>
              <li>Updated: {now.toLocaleString('en-US')}</li>
              <li>Incidents: {`${SITE_URL}/datasets/incidents.ndjson`}</li>
              <li>Metrics: {`${SITE_URL}/datasets/metrics.csv`}</li>
            </ul>
          </section>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
