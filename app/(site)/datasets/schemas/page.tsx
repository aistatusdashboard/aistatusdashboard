import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dataset Schemas',
  description: 'JSON schema files for AIStatusDashboard datasets.',
  alternates: {
    canonical: '/datasets/schemas',
  },
};

export default function DatasetSchemasPage() {
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Schemas
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              Dataset schemas
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              JSON Schema definitions for dataset rows.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-6 space-y-2">
              <li><a className="underline" href="/datasets/schemas/incidents.schema.json">incidents.schema.json</a></li>
              <li><a className="underline" href="/datasets/schemas/metrics.schema.json">metrics.schema.json</a></li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
