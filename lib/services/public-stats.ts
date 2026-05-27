import { Timestamp } from "firebase-admin/firestore";
import { getLivePulseSnapshot } from "@/lib/services/live-pulse";
import { getDb } from "@/lib/db/firestore";
import { siblingsFor } from "@/lib/cross-project";

export type PublicStatsPayload = {
  providers_tracked: number;
  incidents_24h: number;
  incidents_7d_total: number;
  incidents_30d_total: number;
  active_incidents_now: number;
  avg_latency_ms_current: number;
  community_reports_10m: number;
  community_reports_7d: number;
  fallback_plans_generated_7d: number;
  policies_generated_7d: number;
  casual_status_calls_7d: number;
  casual_status_calls_30d: number;
  datasets_published: {
    incidents_ndjson_bytes: number;
    metrics_csv_bytes: number;
  };
  last_check_ts: string | null;
  generated_at: string;
  siblings: ReturnType<typeof siblingsFor>;
};

let cache:
  | {
      expiresAt: number;
      payload: PublicStatsPayload;
    }
  | undefined;
let inFlight: Promise<PublicStatsPayload> | undefined;

function toUnixSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

async function countDocs(collectionName: string, secondsAgo: number) {
  const db = getDb();
  const since = new Date(Date.now() - secondsAgo * 1000);
  try {
    const snap = await db
      .collection(collectionName)
      .where("createdAt", ">=", Timestamp.fromDate(since))
      .count()
      .get();
    return Number(snap.data().count || 0);
  } catch {
    const snap = await db
      .collection(collectionName)
      .where("createdAt", ">=", Timestamp.fromDate(since))
      .limit(5000)
      .get();
    return snap.size;
  }
}

async function countOpsInAuditLogs(op: string, secondsAgo: number) {
  const db = getDb();
  const since = new Date(Date.now() - secondsAgo * 1000);
  try {
    const snap = await db
      .collection("api_logs")
      .where("route", "==", op)
      .where("createdAt", ">=", Timestamp.fromDate(since))
      .count()
      .get();
    return Number(snap.data().count || 0);
  } catch {
    return 0;
  }
}

async function countActiveIncidentsNow() {
  const db = getDb();
  try {
    const snap = await db.collection("incidents").limit(500).get();
    const inactive = new Set(["resolved", "completed", "cancelled"]);
    let active = 0;
    for (const doc of snap.docs) {
      const status = String(doc.data()?.status || "").toLowerCase();
      if (!inactive.has(status)) active += 1;
    }
    return active;
  } catch {
    return 0;
  }
}

export async function loadPublicStats(): Promise<PublicStatsPayload> {
  if (cache && cache.expiresAt > Date.now()) return cache.payload;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const pulse = await getLivePulseSnapshot();
    const [incidents7d, incidents30d, reports7d, fallback7d, policy7d, casual7d, casual30d, activeNow] =
      await Promise.all([
        countDocs("incidents", toUnixSeconds(7 * 24 * 60 * 60 * 1000)),
        countDocs("incidents", toUnixSeconds(30 * 24 * 60 * 60 * 1000)),
        countDocs("casual_reports", toUnixSeconds(7 * 24 * 60 * 60 * 1000)),
        countOpsInAuditLogs("/api/public/v1/recommendations/fallback_plan", toUnixSeconds(7 * 24 * 60 * 60 * 1000)),
        countOpsInAuditLogs("/api/public/v1/policy/generate", toUnixSeconds(7 * 24 * 60 * 60 * 1000)),
        countOpsInAuditLogs("/api/public/v1/casual/status", toUnixSeconds(7 * 24 * 60 * 60 * 1000)),
        countOpsInAuditLogs("/api/public/v1/casual/status", toUnixSeconds(30 * 24 * 60 * 60 * 1000)),
        countActiveIncidentsNow(),
      ]);

    const payload: PublicStatsPayload = {
      providers_tracked: pulse.tracking,
      incidents_24h: pulse.incidents24h,
      incidents_7d_total: incidents7d,
      incidents_30d_total: incidents30d,
      active_incidents_now: activeNow,
      avg_latency_ms_current: pulse.avgLatency ?? 0,
      community_reports_10m: pulse.communityReports ?? 0,
      community_reports_7d: reports7d,
      fallback_plans_generated_7d: fallback7d,
      policies_generated_7d: policy7d,
      casual_status_calls_7d: casual7d,
      casual_status_calls_30d: casual30d,
      datasets_published: {
        incidents_ndjson_bytes: 11030,
        metrics_csv_bytes: 347,
      },
      last_check_ts: pulse.lastUpdated,
      generated_at: new Date().toISOString(),
      siblings: siblingsFor("aistatusdashboard"),
    };

    cache = {
      expiresAt: Date.now() + 60_000,
      payload,
    };
    return payload;
  })().finally(() => {
    inFlight = undefined;
  });

  return inFlight;
}
