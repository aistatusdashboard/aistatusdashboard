import { cache } from 'react';
import { getStatusSummary, searchIncidents } from '@/lib/services/public-data';
import { persistenceService } from '@/lib/services/persistence';
import { providerService } from '@/lib/services/providers';
import { getCommunityReportCount } from '@/lib/services/community-reports';

type LivePulseIncident = {
  incident_id: string;
  title: string;
  provider_id?: string;
  providerId?: string;
  updated_at?: string;
  updatedAt?: string;
  permalink: string;
};

export type LivePulseSnapshot = {
  status: 'operational' | 'degraded' | 'down' | 'maintenance' | 'unknown';
  tracking: number;
  lastUpdated: string | null;
  avgLatency: number | null;
  incidents24h: number;
  recentIncidents: LivePulseIncident[];
  communityReports: number | null;
};

function resolveOverallStatus(
  totals: Record<string, number>,
  providers: Array<Record<string, any>>
) {
  const activeIncidentCount = providers.reduce(
    (acc, provider) => acc + Number(provider.active_incident_count || provider.activeIncidentCount || 0),
    0
  );
  if (activeIncidentCount > 0) return 'degraded';
  if ((totals.down || 0) > 0) return 'down';
  if ((totals.degraded || 0) > 0) return 'degraded';
  if ((totals.maintenance || 0) > 0) return 'maintenance';
  if ((totals.operational || 0) > 0) return 'operational';
  return 'unknown';
}

function parseLatestUpdated(providers: Array<Record<string, any>>): string | null {
  const dates = providers
    .map((provider) => provider.last_updated || provider.lastUpdated || provider.last_updated_at)
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);
  return dates.length ? new Date(dates[0]).toISOString() : null;
}

export const getLivePulseSnapshot = cache(async (): Promise<LivePulseSnapshot> => {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return {
      status: 'unknown',
      tracking: providerService.getProviders().length,
      lastUpdated: null,
      avgLatency: null,
      incidents24h: 0,
      recentIncidents: [],
      communityReports: null,
    };
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [summaryPayload, incidentsPayload, communityReports] = await Promise.all([
    getStatusSummary({ windowSeconds: 3600 }),
    searchIncidents({ since: since24h, limit: 200 }),
    getCommunityReportCount(10),
  ]);

  const providers = summaryPayload.data.providers || [];
  const totals = summaryPayload.data.totals || { total: 0 };
  const tracking = totals.total || providers.length || providerService.getProviders().length;
  const status = resolveOverallStatus(totals, providers);
  const lastUpdated = parseLatestUpdated(providers);

  let avgLatency: number | null = null;
  try {
    const history = await persistenceService.getHistory({ limit: 200 });
    const samples = history
      .map((item) => item.responseTime)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    if (samples.length) {
      avgLatency = Math.round(samples.reduce((acc, value) => acc + value, 0) / samples.length);
    }
  } catch {
    avgLatency = null;
  }

  const incidents = (incidentsPayload.data?.incidents || []) as LivePulseIncident[];
  const incidents24h = incidents.length;

  return {
    status,
    tracking,
    lastUpdated,
    avgLatency,
    incidents24h,
    recentIncidents: incidents.slice(0, 3),
    communityReports,
  };
});
