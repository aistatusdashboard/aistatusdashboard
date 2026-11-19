import { getDb } from '@/lib/db/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { SourceRegistryEntry } from '@/lib/types/ingestion';

const MAX_PAYLOAD_CHARS = 50000;
const PAYLOAD_TTL_DAYS = 7;

class SourceRegistryService {
  async getEntry(sourceId: string): Promise<SourceRegistryEntry | null> {
    const db = getDb();
    const doc = await db.collection('source_registry').doc(sourceId).get();
    if (!doc.exists) return null;
    const data = doc.data() || {};
    return {
      sourceId,
      providerId: data.providerId,
      platform: data.platform,
      etag: data.etag || null,
      lastModified: data.lastModified || null,
      lastFetchedAt: data.lastFetchedAt?.toDate?.()?.toISOString?.() || data.lastFetchedAt || null,
      lastStatusCode: data.lastStatusCode,
      nextFetchAt: data.nextFetchAt?.toDate?.()?.toISOString?.() || data.nextFetchAt || null,
    } as SourceRegistryEntry;
  }

  async upsertEntry(entry: SourceRegistryEntry) {
    const db = getDb();
    await db.collection('source_registry').doc(entry.sourceId).set(
      {
        providerId: entry.providerId,
        platform: entry.platform,
        etag: entry.etag || null,
        lastModified: entry.lastModified || null,
        lastStatusCode: entry.lastStatusCode || null,
        lastFetchedAt: entry.lastFetchedAt ? Timestamp.fromDate(new Date(entry.lastFetchedAt)) : null,
        nextFetchAt: entry.nextFetchAt ? Timestamp.fromDate(new Date(entry.nextFetchAt)) : null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  // One stored copy per feed, overwritten on each fetch. The only reader is
  // the "not modified" path below, which needs the latest body and nothing
  // else. This used to add a new ~30 KB document on every fetch (about 20,000
  // a day, deleted a week later) - the same "only the newest row is ever read"
  // waste 8731e93 set out to stop.
  private payloadRef(sourceId: string) {
    return getDb().collection('source_payloads').doc(`latest:${sourceId.replace(/\//g, '_')}`);
  }

  async recordPayload(sourceId: string, statusCode: number, body: string | undefined, headers: Record<string, string>) {
    const safeBody = body && body.length > MAX_PAYLOAD_CHARS ? `${body.slice(0, MAX_PAYLOAD_CHARS)}\n...truncated` : body;
    await this.payloadRef(sourceId).set({
      sourceId,
      statusCode,
      body: safeBody || null,
      headers,
      fetchedAt: FieldValue.serverTimestamp(),
      // A feed we stop reading leaves its last copy behind; TTL reclaims it.
      expiresAt: Timestamp.fromDate(new Date(Date.now() + PAYLOAD_TTL_DAYS * 86400_000)),
    });
  }

  async getLatestPayload(sourceId: string): Promise<{ body: string | null; headers: Record<string, string> } | null> {
    const read = (data: FirebaseFirestore.DocumentData) => ({
      body: typeof data.body === 'string' ? data.body : null,
      headers: typeof data.headers === 'object' && data.headers ? data.headers : {},
    });
    try {
      const latest = await this.payloadRef(sourceId).get();
      if (latest.exists) return read(latest.data() || {});
      // Copies written before the single-document scheme (they expire within
      // PAYLOAD_TTL_DAYS of the change).
      const snapshot = await getDb()
        .collection('source_payloads')
        .where('sourceId', '==', sourceId)
        .orderBy('fetchedAt', 'desc')
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      return read(snapshot.docs[0]?.data() || {});
    } catch {
      return null;
    }
  }
}

export const sourceRegistryService = new SourceRegistryService();
