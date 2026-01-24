import type { Metadata } from 'next';

export function generateMetadata({ params }: { params: { series_id: string } }): Metadata {
  return {
    title: `Metrics series ${params.series_id}`,
    alternates: { canonical: `/metrics/${params.series_id}` },
  };
}

export default function MetricsSeriesPage({ params }: { params: { series_id: string } }) {
  const id = params.series_id;
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10 max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Metrics series {id}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Permalink for metrics time series. For machine-readable access, use the JSON variant below.
        </p>
        <a
          href={`/metrics/${id}.json`}
          className="cta-secondary inline-block text-xs"
        >
          View JSON
        </a>
      </div>
    </main>
  );
}
