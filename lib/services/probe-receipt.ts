import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';
import { TtlCache } from '@/lib/utils/ttl-cache';

export type ProbeTick = {
  at: string;
  ok: boolean;
};

export type ProbeReceipt = {
  // 'real' = an actual model request; 'feed' = we read the official status feed.
  kind: 'real' | 'feed';
  at: string;
  latencyMs: number;
  ok: boolean;
  errorCode?: string;
  ticks: ProbeTick[];
};

// The proof behind "we test it ourselves": the latest probe result for a
// provider plus a 24h strip of pass/fail ticks, straight from synthetic_probes.
const receiptCache = new TtlCache<ProbeReceipt | null>(240_000);

export async function getProbeReceipt(providerId: string): Promise<ProbeReceipt | null> {
  const cached = receiptCache.get(providerId);
  if (cached !== undefined) return cached;
  const receipt = await loadProbeReceipt(providerId);
  receiptCache.set(providerId, receipt);
  return receipt;
}

async function loadProbeReceipt(providerId: string): Promise<ProbeReceipt | null> {
  try {
    const db = getDb();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Ascending order matches the existing (providerId, timestamp) index;
    // a descending query would need its own composite index.
    const snapshot = await db
      .collection('synthetic_probes')
      .where('providerId', '==', providerId)
      .where('timestamp', '>=', Timestamp.fromDate(since))
      .orderBy('timestamp', 'asc')
      .limit(500)
      .get();

    if (snapshot.empty) return null;

    const rows = snapshot.docs.reverse().map((doc) => {
      const data = doc.data();
      const ts = data.timestamp?.toDate?.() as Date | undefined;
      return {
        at: ts ? ts.toISOString() : '',
        endpoint: String(data.endpoint || ''),
        latencyMs: Number(data.latencyMs || 0),
        errorCode: data.errorCode ? String(data.errorCode) : undefined,
      };
    }).filter((row) => row.at);

    const real = rows.filter((row) => row.endpoint !== 'status');
    const source = real.length ? real : rows;
    if (!source.length) return null;

    const latest = source[0];
    // Oldest → newest so the strip reads left-to-right in time.
    const ticks = source
      .slice(0, 96)
      .reverse()
      .map((row) => ({ at: row.at, ok: !row.errorCode }));

    return {
      kind: real.length ? 'real' : 'feed',
      at: latest.at,
      latencyMs: latest.latencyMs,
      ok: !latest.errorCode,
      errorCode: latest.errorCode,
      ticks,
    };
  } catch {
    // The receipt is a bonus — never let it break the page.
    return null;
  }
}
