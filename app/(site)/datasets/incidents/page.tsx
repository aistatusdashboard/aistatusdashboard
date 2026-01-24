import type { Metadata } from 'next';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';

export const metadata: Metadata = {
  title: 'Incidents Dataset',
  description: 'Normalized incident dataset from AIStatusDashboard.',
  alternates: {
    canonical: '/datasets/incidents',
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

export default async function IncidentsDatasetPage() {
  const incidents = (await intelligenceService.getIncidents({ limit: 200 })).map(normalizeIncidentDates);
  const rows = incidents.map((incident) =>
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
  const rowCount = incidents.length;
  const updatedAt = incidents[0]?.updatedAt || new Date().toISOString();
  const bytes = Buffer.byteLength(rows.join('\n'), 'utf8');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'AIStatusDashboard Incidents Dataset',
    url: `${SITE_URL}/datasets/incidents`,
    description: 'Normalized incidents across AI providers with updates and severity metadata.',
    temporalCoverage: '2024-01-01/2025-12-31',
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/x-ndjson',
        contentUrl: `${SITE_URL}/datasets/incidents.ndjson`,
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
              Incidents NDJSON
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Download the machine-readable incidents feed.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <a href="/datasets/incidents.ndjson" className="cta-secondary text-xs">
              Download incidents.ndjson
            </a>
            <a href="/datasets/schemas/incidents.schema.json" className="cta-secondary text-xs">
              View JSON schema
            </a>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <li>Rows: {rowCount}</li>
              <li>Download size: {formatBytes(bytes)}</li>
              <li>Updated: {new Date(updatedAt).toLocaleString('en-US')}</li>
            </ul>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Cite this dataset</h2>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <li>Canonical: {`${SITE_URL}/datasets/incidents`}</li>
              <li>Download: {`${SITE_URL}/datasets/incidents.ndjson`}</li>
              <li>Updated: {new Date(updatedAt).toLocaleString('en-US')}</li>
              <li>Evidence API: {`${SITE_URL}/api/public/v1/incidents?limit=50`}</li>
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
