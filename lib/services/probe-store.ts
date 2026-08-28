import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';
import type { SyntheticProbeEvent } from '@/lib/types/insights';

const PROBE_TTL_DAYS = 30;

// Every verdict render used to scan ~114 raw probe documents per provider, so
// rendering the 26-app board cost thousands of reads per cycle. Each provider
// now also keeps a single rollup document holding its recent probes, which is
// all the read paths need: one read per provider instead of a windowed query.
const ROLLUP_COLLECTION = 'probe_rollups';
const ROLLUP_MAX_EVENTS = 200;
const ROLLUP_WINDOW_MS = 48 * 60 * 60 * 1000;

async function appendToRollup(
  db: FirebaseFirestore.Firestore,
  providerId: string,
  event: FirebaseFirestore.DocumentData
): Promise<void> {
  const ref = db.collection(ROLLUP_COLLECTION).doc(providerId);
  const snapshot = await ref.get();
  const previous: FirebaseFirestore.DocumentData[] = snapshot.exists
    ? (snapshot.data()?.events as FirebaseFirestore.DocumentData[]) || []
    : [];
  const cutoff = Date.now() - ROLLUP_WINDOW_MS;
  const events = [...previous, event]
    .filter((item) => {
      const ms = typeof item?.timestamp?.toMillis === 'function' ? item.timestamp.toMillis() : 0;
      return ms >= cutoff;
    })
    .slice(-ROLLUP_MAX_EVENTS);
  await ref.set({ providerId, events, updatedAt: Timestamp.fromDate(new Date()) });
}

// Probe results land in `synthetic_probes`, which casual.ts reads to compare
// what we observe against what the provider's status page admits.
export async function storeSyntheticProbe(payload: Omit<SyntheticProbeEvent, 'timestamp'>) {
  const db = getDb();
  const record: FirebaseFirestore.DocumentData = {
    providerId: payload.providerId,
    model: payload.model,
    endpoint: payload.endpoint,
    region: payload.region,
    tier: payload.tier || 'unknown',
    streaming: Boolean(payload.streaming),
    timestamp: Timestamp.fromDate(new Date()),
    latencyMs: payload.latencyMs,
    latencyP50: payload.latencyP50,
    latencyP95: payload.latencyP95,
    latencyP99: payload.latencyP99,
    http5xxRate: payload.http5xxRate,
    http429Rate: payload.http429Rate,
    tokensPerSec: payload.tokensPerSec,
    streamDisconnectRate: payload.streamDisconnectRate,
    errorCode: payload.errorCode,
    createdAt: FieldValue.serverTimestamp(),
    // Receipts show the last 24h and casual.ts reads a few hundred rows; a
    // Firestore TTL policy on this field reclaims everything older.
    expiresAt: Timestamp.fromDate(new Date(Date.now() + PROBE_TTL_DAYS * 86400_000)),
  };

  await db.collection('synthetic_probes').add(record);

  // The rollup is what every read path uses; a failure here must never lose the
  // probe itself, which is already stored above.
  try {
    const { expiresAt, createdAt, ...rollupEvent } = record;
    await appendToRollup(db, payload.providerId, rollupEvent);
  } catch {
    /* rollup is a cache: rebuilt on the next probe */
  }
}

// Recent probes for a provider, newest last. Returns null when no rollup exists
// yet so callers can fall back to querying the raw collection.
export async function readProbeRollup(
  providerId: string
): Promise<FirebaseFirestore.DocumentData[] | null> {
  const db = getDb();
  const snapshot = await db.collection(ROLLUP_COLLECTION).doc(providerId).get();
  if (!snapshot.exists) return null;
  const events = snapshot.data()?.events as FirebaseFirestore.DocumentData[] | undefined;
  return Array.isArray(events) ? events : null;
}
