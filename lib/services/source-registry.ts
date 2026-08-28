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

  async recordPayload(sourceId: string, statusCode: number, body: string | undefined, headers: Record<string, string>) {
    const db = getDb();
    const safeBody = body && body.length > MAX_PAYLOAD_CHARS ? `${body.slice(0, MAX_PAYLOAD_CHARS)}\n...truncated` : body;
    await db.collection('source_payloads').add({
      sourceId,
      statusCode,
      body: safeBody || null,
      headers,
      fetchedAt: FieldValue.serverTimestamp(),
      // Only the newest payload per source is ever read; a TTL policy on this
      // field keeps the raw-body archive from growing without bound.
      expiresAt: Timestamp.fromDate(new Date(Date.now() + PAYLOAD_TTL_DAYS * 86400_000)),
    });
  }

  async getLatestPayload(sourceId: string): Promise<{ body: string | null; headers: Record<string, string> } | null> {
    const db = getDb();
    try {
      const snapshot = await db
        .collection('source_payloads')
        .where('sourceId', '==', sourceId)
        .orderBy('fetchedAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      const data = snapshot.docs[0]?.data() || {};
      return {
        body: typeof data.body === 'string' ? data.body : null,
        headers: typeof data.headers === 'object' && data.headers ? data.headers : {},
      };
    } catch {
      return null;
    }
  }
}

export const sourceRegistryService = new SourceRegistryService();
