import { providerService } from '@/lib/services/providers';
import { statusService } from '@/lib/services/status';
import { intelligenceService } from '@/lib/services/intelligence';
import { log } from '@/lib/utils/logger';
import sourcesConfig from '@/lib/data/sources.json';
import DashboardTabs from '../components/DashboardTabs';
import ClientWrapper from '../components/ClientWrapper';
import { Suspense } from 'react';
import Link from 'next/link';
import McpCallout from '../components/McpCallout';

export const dynamic = 'force-dynamic';

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

// Fallback component
function ErrorFallback({ error }: { error: string }) {
  return (
    <main className="flex-1">
      <h1 className="sr-only">AI Status Dashboard</h1>
      <div className="px-4 sm:px-6 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="surface-card-strong p-8 border border-rose-200/70 dark:border-rose-700/70">
            <h2 className="text-2xl font-semibold text-rose-700 dark:text-rose-200 mb-4">
              Service Unavailable
            </h2>
            <p className="text-rose-600 dark:text-rose-300 mb-6">{error}</p>
            <Link
              href="/dashboard"
              className="inline-block cta-primary"
            >
              Refresh Page
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function DashboardPage() {
  let statuses;
  let error: string | null = null;

  try {
    const providers = providerService.getProviders();
    log('info', 'Fetching statuses', { count: providers.length });

    const fallbackStatuses = await statusService.checkAll(providers);
    let summaries: any[] = [];
    try {
      summaries = await intelligenceService.getProviderSummaries();
    } catch (innerError) {
      log('warn', 'Provider summary fetch failed, falling back to direct status', { innerError });
    }

    const summaryMap = new Map(summaries.map((summary) => [summary.providerId, summary]));

    statuses = fallbackStatuses.map((status) => {
      const summary = summaryMap.get(status.id);
      if (!summary) return status;
      const hasEvidence =
        (summary.activeIncidentCount || 0) > 0 ||
        (summary.activeMaintenanceCount || 0) > 0 ||
        (summary.degradedComponentCount || 0) > 0;
      const pollSeconds = sourcePolls.get(status.id) ?? 120;
      const updatedAt = summary.lastUpdated ? Date.parse(summary.lastUpdated) : NaN;
      const isFresh =
        Number.isFinite(updatedAt) &&
        Date.now() - updatedAt <= pollSeconds * 2 * 1000 + 60000;
      const useSummary =
        !!summary.status &&
        summary.status !== 'unknown' &&
        hasEvidence &&
        isFresh;
      const mergedStatus = useSummary ? summary.status : status.status;
      return {
        ...status,
        status: mergedStatus,
        details: useSummary ? summary.description || status.details : status.details,
        lastChecked: useSummary ? summary.lastUpdated || status.lastChecked : status.lastChecked,
      };
    });

    // Calculate stats
    const stats = {
      total: statuses.length,
      operational: statuses.filter(s => s.status === 'operational').length,
      down: statuses.filter(s => s.status === 'down' || s.status === 'major_outage').length,
      degraded: statuses.filter(s => s.status === 'degraded' || s.status === 'partial_outage').length,
      unknown: statuses.filter(s => s.status === 'unknown').length
    };

    log('info', 'Status fetch complete', stats);

    if (stats.unknown > stats.total / 2) {
      error = 'High rate of unknown statuses detected';
    }

  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
    log('error', 'Dashboard load failed', { error });
  }

  if (error && !statuses) {
    return <ErrorFallback error={error} />;
  }

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-8">
        <noscript>
          <div className="surface-card p-4 mb-4">
            <p>AI Status Dashboard snapshot (noscript):</p>
            <ul>
              <li><a href="/api/public/v1/status/summary">/api/public/v1/status/summary</a></li>
              <li><a href="/api/public/v1/incidents">/api/public/v1/incidents</a></li>
              <li><a href="/openapi.json">OpenAPI</a></li>
              <li><a href="/llms.txt">llms.txt</a></li>
            </ul>
          </div>
        </noscript>
        <div className="max-w-6xl mx-auto mb-6">
          <McpCallout />
        </div>
        <div className="max-w-6xl mx-auto mb-6 surface-card border border-slate-200/70 dark:border-slate-700/70 p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Casual Mode</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Plain-English status for everyday users. Start with ChatGPT or browse all casual pages.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/casual/chatgpt" className="cta-primary text-xs">ChatGPT Status</Link>
            <Link href="/casual" className="cta-secondary text-xs">View all</Link>
          </div>
        </div>
        {error && (
          <div className="max-w-6xl mx-auto mb-6 surface-card border border-amber-200/70 dark:border-amber-700/70 p-4">
            <p className="text-amber-800 dark:text-amber-200 text-sm">
              Warning: {error}
            </p>
          </div>
        )}
        <ClientWrapper>
          <Suspense fallback={null}>
            <DashboardTabs statuses={statuses || []} />
          </Suspense>
        </ClientWrapper>
      </div>
    </main>
  );
}
