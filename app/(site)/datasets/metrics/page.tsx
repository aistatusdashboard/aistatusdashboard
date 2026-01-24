import type { Metadata } from 'next';
import { listProviders } from '@/lib/services/public-data';
import { queryMetricSeries } from '@/lib/services/metrics';

export const metadata: Metadata = {
  title: 'Metrics Dataset',
  description: 'Aggregated metrics dataset from AIStatusDashboard.',
  alternates: {
    canonical: '/datasets/metrics',
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

export default async function MetricsDatasetPage() {
  const providers = listProviders().slice(0, 6);
  const until = new Date();
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  const rows: string[] = ['timestamp,provider_id,metric,value,sample_count,sources'];

  for (const provider of providers) {
    const series = await queryMetricSeries({
      metric: 'latency_p95_ms',
      providerId: provider.id,
      since,
      until,
      granularitySeconds: 3600,
    });
    series.series.forEach((point) => {
      rows.push(
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

  const rowCount = Math.max(rows.length - 1, 0);
  const bytes = Buffer.byteLength(rows.join('\n'), 'utf8');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'AIStatusDashboard Metrics Dataset',
    url: `${SITE_URL}/datasets/metrics`,
    description: 'Aggregated latency and reliability metrics across AI providers.',
    temporalCoverage: '2024-01-01/2025-12-31',
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'text/csv',
        contentUrl: `${SITE_URL}/datasets/metrics.csv`,
      },
    ],
  };

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Dataset
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Metrics CSV
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Download aggregated metrics and latency indicators.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <a href="/datasets/metrics.csv" className="cta-secondary text-xs">
              Download metrics.csv
            </a>
            <a href="/datasets/schemas/metrics.schema.json" className="cta-secondary text-xs">
              View JSON schema
            </a>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <li>Rows: {rowCount}</li>
              <li>Download size: {formatBytes(bytes)}</li>
              <li>Updated: {until.toLocaleString('en-US')}</li>
            </ul>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cite this dataset</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>Canonical: {`${SITE_URL}/datasets/metrics`}</li>
              <li>Download: {`${SITE_URL}/datasets/metrics.csv`}</li>
              <li>Updated: {until.toLocaleString('en-US')}</li>
              <li>Evidence API: {`${SITE_URL}/api/public/v1/metrics?metric=latency_p95_ms`}</li>
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
