import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';
import { TtlCache } from '@/lib/utils/ttl-cache';
import { verdictKey, type VerdictKey } from '@/lib/ui/verdict';
import { OFFICIAL_FEED_STALE_MS, officialSignal } from '@/lib/services/casual';
import { log } from '@/lib/utils/logger';

// The 30-day colour bar on each app page.
//
// The ingest cron reads every provider's official status every five minutes
// and stores the result in `provider_status` - the same record the app pages
// take their verdict from. After each cycle we tally that verdict into ONE
// small document: per day, per provider, how many readings were up / having
// issues / down. A page render costs a single cached document read, and each
// cycle one write, instead of pages digging through a 5-minute log.
//
// It is fed from the ingest pipeline on purpose: the older status cron only
// knows a subset of providers, so a bar built on it misses the newer apps.
export const STRIP_DAYS = 30;
const SAMPLE_MINUTES = 5; // ingest cron cadence
const DOC_PATH = 'config/status_strip';

type DayCounts = Partial<Record<VerdictKey, number>>;
type StripDoc = { days?: Record<string, Record<string, DayCounts>> };

export type StripLevel = VerdictKey | 'nodata';
export type StripDay = {
  date: string; // YYYY-MM-DD (UTC)
  level: StripLevel;
  wobblyMinutes: number;
  downMinutes: number;
};

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBack(from: Date, n: number): string {
  return dayKey(new Date(from.getTime() - n * 86_400_000));
}

/** Reduce one day's tallies to a single level. Unknown readings (our fetch
 *  failed) say nothing about the service, so they never colour a day. */
export function levelForDay(counts: DayCounts | undefined): StripLevel {
  if (!counts) return 'nodata';
  if ((counts.down || 0) > 0) return 'down';
  if ((counts.wobbly || 0) > 0) return 'wobbly';
  if ((counts.up || 0) > 0) return 'up';
  return 'nodata';
}

/** Tally key for an app that is only part of its provider's page. */
export function appKey(appId: string): string {
  return `app:${appId}`;
}

export function buildStrip(doc: StripDoc | undefined, providerId: string, now = new Date(), appId?: string): StripDay[] {
  const out: StripDay[] = [];
  for (let i = STRIP_DAYS - 1; i >= 0; i--) {
    const date = daysBack(now, i);
    // A scoped app's own tally when that day has one; days recorded before
    // scoping existed only have the provider-wide tally.
    const counts = (appId && doc?.days?.[date]?.[appKey(appId)]) || doc?.days?.[date]?.[providerId];
    out.push({
      date,
      level: levelForDay(counts),
      wobblyMinutes: (counts?.wobbly || 0) * SAMPLE_MINUTES,
      downMinutes: (counts?.down || 0) * SAMPLE_MINUTES,
    });
  }
  return out;
}

/** The level an app page would have shown for this provider_status record:
 *  the provider's own word, or unknown when the page is unreadable or stale. */
export function levelForOfficial(status: string | undefined, lastUpdatedMs: number, nowMs: number): VerdictKey {
  if (!Number.isFinite(lastUpdatedMs) || nowMs - lastUpdatedMs >= OFFICIAL_FEED_STALE_MS) return 'unknown';
  return verdictKey(officialSignal(status));
}

/** Called once per ingest cycle. Reads the providers' current official
 *  statuses (one small collection) and tallies them. One write. */
export async function recordStripCycle(now = new Date()): Promise<number> {
  try {
    const snapshot = await getDb().collection('provider_status').get();
    if (snapshot.empty) return 0;
    const today: Record<string, Record<string, FieldValue>> = {};
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const lastUpdatedMs = data.lastUpdated?.toDate?.()?.getTime?.() ?? NaN;
      const level = levelForOfficial(data.status, lastUpdatedMs, now.getTime());
      today[doc.id] = { [level]: FieldValue.increment(1) };
      // Apps scoped to part of this provider's page get their own tally, so
      // ChatGPT's bar is not coloured by an API-only incident.
      const appStatus = data.appStatus && typeof data.appStatus === 'object' ? data.appStatus : {};
      for (const [appId, status] of Object.entries(appStatus as Record<string, string | null>)) {
        if (!status) continue;
        today[appKey(appId)] = { [levelForOfficial(status, lastUpdatedMs, now.getTime())]: FieldValue.increment(1) };
      }
    }
    const days: Record<string, unknown> = { [dayKey(now)]: today };
    // Drop days that have slid out of the window so the document stays small.
    for (let i = STRIP_DAYS + 1; i <= STRIP_DAYS + 5; i++) {
      days[daysBack(now, i)] = FieldValue.delete();
    }
    await getDb().doc(DOC_PATH).set({ days, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return snapshot.size;
  } catch (error) {
    log('error', 'Failed to record status strip cycle', { error });
    return 0;
  }
}

const stripCache = new TtlCache<StripDoc>(240_000, 1);
let inflight: Promise<StripDoc> | null = null;

async function loadStripDoc(): Promise<StripDoc> {
  const cached = stripCache.get('doc');
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const snap = await getDb().doc(DOC_PATH).get();
      const data = (snap.data() as StripDoc | undefined) || {};
      stripCache.set('doc', data);
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getStatusStrip(providerId: string, appId?: string): Promise<StripDay[]> {
  const doc = await loadStripDoc().catch(() => undefined);
  return buildStrip(doc, providerId, new Date(), appId);
}
