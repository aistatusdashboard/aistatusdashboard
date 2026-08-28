import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';
import type { SyntheticProbeEvent } from '@/lib/types/insights';

const PROBE_TTL_DAYS = 30;

// Probe results land in `synthetic_probes`, which casual.ts reads to compare
// what we observe against what the provider's status page admits.
export async function storeSyntheticProbe(payload: Omit<SyntheticProbeEvent, 'timestamp'>) {
  const db = getDb();
  await db.collection('synthetic_probes').add({
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
  });
}
