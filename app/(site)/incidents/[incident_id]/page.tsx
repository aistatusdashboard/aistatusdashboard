import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getIncidentById } from '@/lib/services/public-data';
import { providerService } from '@/lib/services/providers';
import { intelligenceService } from '@/lib/services/intelligence';
import { appIdForProvider, appNameForProvider } from '@/lib/casual/app-lookup';
import { formatTimeAgo } from '@/lib/utils/time';
import { log } from '@/lib/utils/logger';

function providerLabel(providerId: string): string {
  const provider = providerService.getProvider(providerId);
  return provider?.displayName || provider?.name || providerId;
}

function formatWhen(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

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

function summarizeIncident(incident: Awaited<ReturnType<typeof getIncidentById>>): string {
  if (!incident) return 'Incident detail from AI Status Dashboard.';
  const fromUpdate = incident.updates?.find((update) => update.body?.trim())?.body?.trim();
  const candidate = fromUpdate || incident.title || 'Incident detail from AI Status Dashboard.';
  return candidate.length > 140 ? `${candidate.slice(0, 137)}...` : candidate;
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
  const incident = incidentId ? await getIncidentById(incidentId) : null;
  // Title in the words people search during an outage: app name + what broke + when.
  const startedDate = incident?.startedAt
    ? new Date(incident.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null;
  const title = incident
    ? `${providerLabel(incident.providerId)} outage: ${incident.title}${startedDate ? ` (${startedDate})` : ''}`
    : `Incident ${safeId}`;
  const description = incident
    ? `${incident.resolvedAt ? 'Resolved' : 'Ongoing'} ${providerLabel(incident.providerId)} incident${startedDate ? ` from ${startedDate}` : ''}: ${summarizeIncident(incident)}`
    : summarizeIncident(incident);

  return {
    title,
    description,
    alternates: {
      canonical: `/incidents/${safeId}`,
    },
    openGraph: {
      title: `${title} | AI Status Dashboard`,
      description,
      images: [{ url: `https://aistatusdashboard.com/og/incident/${encodeURIComponent(safeId)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | AI Status Dashboard`,
      description,
      images: [`https://aistatusdashboard.com/og/incident/${encodeURIComponent(safeId)}`],
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

  const providerName = providerLabel(incident.providerId);
  const appId = appIdForProvider(incident.providerId);
  const appName = appNameForProvider(incident.providerId);
  const latestUpdate = [...(incident.updates || [])]
    .filter((u) => u.body?.trim())
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0]?.body?.trim();

  // Other incidents for the same service — internal links that give Google a
  // reason to crawl deeper and keep a visitor on the site.
  let related: Array<{ id: string; title: string; startedAt: string; resolvedAt?: string }> = [];
  try {
    const rows = await intelligenceService.getIncidents({ providerId: incident.providerId, limit: 8 });
    related = rows
      .filter((row) => `${row.providerId}:${row.id}` !== incident.incident_id)
      .slice(0, 6)
      .map((row) => ({ id: `${row.providerId}:${row.id}`, title: row.title, startedAt: row.startedAt, resolvedAt: row.resolvedAt }));
  } catch {
    related = [];
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
    description: latestUpdate || incident.title,
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

  const resolved =
    ['resolved', 'completed', 'cancelled'].includes(String(incident.status || '').toLowerCase()) ||
    Boolean(incident.resolvedAt);
  const startedLabel = incident.startedAt
    ? new Date(incident.startedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null;
  const impactedParts = [
    incident.impactedComponentNames?.length
      ? incident.impactedComponentNames.join(', ')
      : incident.impactedComponents?.length
        ? incident.impactedComponents.join(', ')
        : null,
    incident.impactedRegions?.length ? `regions: ${incident.impactedRegions.join(', ')}` : null,
    incident.impactedModels?.length ? `models: ${incident.impactedModels.join(', ')}` : null,
  ].filter(Boolean);

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="pt-4 space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            <Link href={`/${appId}`} className="hover:underline">{providerName}</Link> · {formatTimeAgo(incident.updatedAt)}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            {incident.title}
          </h1>
          <span className="flex flex-wrap gap-2">
            <span
              className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${
                resolved
                  ? 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700'
                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
              }`}
            >
              {resolved ? 'Resolved' : 'Ongoing'}
            </span>
          </span>
          {/* The plain-English answer, in the words people search during an outage. */}
          <p className="text-base text-slate-700 dark:text-slate-200">
            {resolved
              ? `Yes — ${appName} had a problem${startedLabel ? ` on ${startedLabel}` : ''}, and ${providerName} has since marked it resolved.`
              : `Yes — ${appName} is having a problem right now. ${providerName} currently reports this incident as ${incident.status}.`}
            {latestUpdate ? ` ${providerName}'s latest word: “${latestUpdate}”` : ''}
          </p>
          <p className="text-sm">
            <Link href={`/${appId}`} className="underline text-slate-700 dark:text-slate-200">
              See {appName}&apos;s live status →
            </Link>
          </p>
        </header>

        <section className="surface-card p-6 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Timeline</h2>
          <p>Started: {formatWhen(incident.startedAt)}</p>
          <p>Last update: {formatWhen(incident.updatedAt)}</p>
          {incident.resolvedAt && <p>Resolved: {formatWhen(incident.resolvedAt)}</p>}
          {impactedParts.length > 0 && <p>Affected: {impactedParts.join(' · ')}</p>}
          {incident.rawUrl && (
            <p>
              <a
                href={incident.rawUrl}
                className="underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                {providerLabel(incident.providerId)}&apos;s official report →
              </a>
            </p>
          )}
        </section>

        {incident.updates && incident.updates.length > 0 && (
          <section className="surface-card p-6 space-y-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Updates</h2>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {incident.updates.map((update) => (
                <li key={update.id} className="border-l border-slate-200 dark:border-slate-700 pl-4">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{update.status}</p>
                  <p>{update.body}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatWhen(update.createdAt)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {related.length > 0 && (
          <section className="surface-card p-6 space-y-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">More {providerName} incidents</h2>
            <ul className="space-y-2 text-sm">
              {related.map((row) => (
                <li key={row.id}>
                  <Link href={`/incidents/${row.id}`} className="text-slate-700 dark:text-slate-200 hover:underline">
                    {row.title}
                  </Link>
                  <span className="text-slate-500 dark:text-slate-400">
                    {' '}— {row.resolvedAt ? 'resolved' : 'ongoing'}
                    {row.startedAt ? `, ${formatTimeAgo(row.startedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="flex flex-wrap gap-4 text-sm">
          <Link href={`/${appId}`} className="underline text-slate-700 dark:text-slate-200">
            Is {appName} down right now?
          </Link>
          <Link href="/incidents" className="underline text-slate-700 dark:text-slate-200">
            All outage history →
          </Link>
        </p>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </div>
    </main>
  );
}
