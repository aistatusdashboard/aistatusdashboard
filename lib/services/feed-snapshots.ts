import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';

// Some official status pages (Mistral on Rootly) sit behind a Cloudflare
// JavaScript challenge and expose no JSON or RSS. A scheduled GitHub Actions
// job renders them in a real browser and posts what it read here; ingestion
// then treats the snapshot exactly like any other feed response.
const COLLECTION = 'feed_snapshots';
export const FEED_SNAPSHOT_STALE_MS = 60 * 60 * 1000;

export type BrowserFeedIncident = {
  id: string;
  url?: string;
  title: string;
  status: string;
  message?: string;
  shownAt: string; // ISO — the timestamp the page displays next to the entry
  durationMinutes?: number;
};

export type BrowserFeedSnapshot = {
  sourceId: string;
  providerId: string;
  platform: string;
  fetchedAt: string;
  overall: string;
  components: Array<{ name: string; status: string }>;
  incidents: BrowserFeedIncident[];
};

export function isBrowserFeedSnapshot(value: unknown): value is BrowserFeedSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sourceId === 'string' &&
    typeof v.providerId === 'string' &&
    typeof v.platform === 'string' &&
    typeof v.overall === 'string' &&
    Array.isArray(v.components) &&
    Array.isArray(v.incidents)
  );
}

export async function writeFeedSnapshot(snapshot: BrowserFeedSnapshot): Promise<void> {
  const db = getDb();
  await db
    .collection(COLLECTION)
    .doc(snapshot.sourceId)
    .set({ ...snapshot, fetchedAt: new Date().toISOString(), storedAt: Timestamp.fromDate(new Date()) });
}

// Null when there is no snapshot or it is older than the staleness window —
// the caller treats that like an unreachable feed.
export async function readFeedSnapshot(sourceId: string): Promise<BrowserFeedSnapshot | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(sourceId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!isBrowserFeedSnapshot(data)) return null;
  const age = Date.now() - Date.parse(data.fetchedAt || '');
  if (!Number.isFinite(age) || age > FEED_SNAPSHOT_STALE_MS) return null;
  return data;
}
