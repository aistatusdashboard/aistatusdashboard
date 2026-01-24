import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getIncidentById } from '@/lib/services/public-data';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

type IncidentParams = { incident_id: string };

async function resolveParams(params: IncidentParams | Promise<IncidentParams>) {
  return Promise.resolve(params);
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractIncidentId(path?: string | null) {
  if (!path) return undefined;
  const match = path.match(/\/incidents\/([^/?#]+)/i);
  return match ? safeDecode(match[1]) : undefined;
}

async function resolveIncidentId(params: IncidentParams | Promise<IncidentParams>) {
  const resolvedParams = await resolveParams(params);
  if (resolvedParams?.incident_id) return safeDecode(resolvedParams.incident_id);
  const headerList = await headers();
  const fallbackPath =
    headerList.get('x-forwarded-uri') ||
    headerList.get('x-original-url') ||
    headerList.get('x-url') ||
    headerList.get('x-rewrite-url') ||
    headerList.get('x-invoke-path');
  const extracted = extractIncidentId(fallbackPath);
  if (!extracted) {
    log('warn', 'Incident param missing', {
      fallbackPath,
      headerSample: Array.from(headerList.keys()).slice(0, 8),
    });
  }
  return extracted;
}

export async function generateMetadata({
  params,
}: {
  params: IncidentParams | Promise<IncidentParams>;
}): Promise<Metadata> {
  const incidentId = await resolveIncidentId(params);
  const safeId = incidentId || 'unknown';
  return {
    title: `Incident ${safeId}`,
    description: 'Incident detail from AIStatusDashboard.',
    alternates: {
      canonical: `/incidents/${safeId}`,
    },
  };
}

export default async function IncidentDetailPage({
  params,
}: {
  params: IncidentParams | Promise<IncidentParams>;
}) {
  const incidentId = await resolveIncidentId(params);
  if (!incidentId) {
    notFound();
  }

  const incident = await getIncidentById(incidentId);

  if (!incident) {
    notFound();
  }

  const statusMap: Record<string, string> = {
    resolved: 'https://schema.org/EventCompleted',
    monitoring: 'https://schema.org/EventScheduled',
    identified: 'https://schema.org/EventScheduled',
    investigating: 'https://schema.org/EventScheduled',
    update: 'https://schema.org/EventScheduled',
  };
  const eventStatus = statusMap[incident.status] || 'https://schema.org/EventScheduled';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: incident.title,
    description: incident.title,
    startDate: incident.startedAt,
    endDate: incident.resolvedAt || undefined,
    eventStatus,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'VirtualLocation',
      url: incident.rawUrl || `https://aistatusdashboard.com/incidents/${incident.incident_id}`,
    },
    isBasedOn: incident.rawUrl || undefined,
    identifier: incident.incident_id,
    organizer: {
      '@type': 'Organization',
      name: 'AI Status Dashboard',
      url: 'https://aistatusdashboard.com',
    },
  };

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              {incident.providerId}
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              {incident.title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Status: {incident.status} | Severity: {incident.severity}
            </p>
            <a
              href={`/incidents/${incident.incident_id}/cite`}
              className="cta-secondary text-xs inline-block mt-3"
            >
              Cite this incident
            </a>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Timeline</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Started: {incident.startedAt}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Updated: {incident.updatedAt}
            </p>
            {incident.resolvedAt && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Resolved: {incident.resolvedAt}
              </p>
            )}
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Impact scope</h2>
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
              <p>Impacted regions: {incident.impactedRegions?.length ? incident.impactedRegions.join(', ') : 'None reported'}</p>
              <p>Impacted models: {incident.impactedModels?.length ? incident.impactedModels.join(', ') : 'None reported'}</p>
              <p>
                Impacted components:{' '}
                {incident.impactedComponentNames?.length
                  ? incident.impactedComponentNames.join(', ')
                  : incident.impactedComponents?.length
                    ? incident.impactedComponents.join(', ')
                    : 'None reported'}
              </p>
            </div>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Official sources</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Provider: {incident.providerId}
            </p>
            {incident.rawUrl ? (
              <a
                href={incident.rawUrl}
                className="text-sm text-blue-600 hover:text-blue-700 underline underline-offset-2"
                rel="noopener noreferrer"
                target="_blank"
              >
                View official incident page
              </a>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Official incident URL not available for this source.
              </p>
            )}
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Updates</h2>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {incident.updates?.map((update) => (
                <li key={update.id} className="border-l border-slate-200 dark:border-slate-700 pl-4">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{update.status}</p>
                  <p>{update.body}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{update.createdAt}</p>
                </li>
              ))}
            </ul>
          </section>

          <noscript>
            <div className="surface-card p-4">
              <p>Incident {incident.id}: {incident.title}</p>
              <p>Status: {incident.status}. Data: /api/public/v1/incidents</p>
            </div>
          </noscript>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </div>
      </div>
    </main>
  );
}
