import { cache } from 'react';
import { intelligenceService, type ProviderStatusSummary } from '@/lib/services/intelligence';

// What the navbar's "Live - updated 3 min ago" pill and the home share image
// need: when the official statuses were last read, and whether anything is in
// trouble right now.
//
// This used to assemble a much larger snapshot (300 recent incidents, the last
// 200 status_history rows, a casual_reports scan) on every refresh, although
// the navbar only ever displayed the timestamp - about 500 document reads every
// four minutes, the second-largest reader on the site. Everything it needs is
// already in the provider summaries, which every page loads and caches anyway,
// so this now costs no reads of its own.
export type LivePulseSnapshot = {
  status: 'operational' | 'degraded' | 'down' | 'maintenance' | 'unknown';
  lastUpdated: string | null;
};

export function summarizePulse(summaries: ProviderStatusSummary[]): LivePulseSnapshot {
  let latest = 0;
  let activeIncidents = 0;
  const seen = { down: false, degraded: false, maintenance: false, operational: false };
  for (const summary of summaries) {
    const updated = summary.lastUpdated ? Date.parse(summary.lastUpdated) : NaN;
    if (Number.isFinite(updated) && updated > latest) latest = updated;
    activeIncidents += Number(summary.activeIncidentCount || 0);
    const status = String(summary.status || '').toLowerCase();
    if (status === 'down' || status.includes('major')) seen.down = true;
    else if (status === 'degraded' || status.includes('partial')) seen.degraded = true;
    else if (status === 'maintenance') seen.maintenance = true;
    else if (status === 'operational') seen.operational = true;
  }
  // Same precedence the old snapshot used: an open incident anywhere reads as
  // "having issues" before any single provider's banner is considered.
  const status: LivePulseSnapshot['status'] =
    activeIncidents > 0 ? 'degraded'
    : seen.down ? 'down'
    : seen.degraded ? 'degraded'
    : seen.maintenance ? 'maintenance'
    : seen.operational ? 'operational'
    : 'unknown';
  return { status, lastUpdated: latest ? new Date(latest).toISOString() : null };
}

export const getLivePulseSnapshot = cache(async (): Promise<LivePulseSnapshot> => {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return { status: 'unknown', lastUpdated: null };
  }
  return summarizePulse(await intelligenceService.getProviderSummaries());
});
