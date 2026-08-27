import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';
import { intelligenceService } from '@/lib/services/intelligence';
import { log } from '@/lib/utils/logger';

// The "caught it first" detector: an open gap means our real API probes are
// failing while the provider's official status page still claims operational.
// Two consecutive failures are required so a single blip never raises a flag.

const CONSECUTIVE_FAILS_TO_OPEN = 2;
const ACK_MATCH_WINDOW_MS = 6 * 60 * 60 * 1000;
const MIN_LEAD_MINUTES = 3;

export type OpenGap = {
  id: string;
  providerId: string;
  startedAt: string;
  failCount: number;
  lastErrorCode?: string;
};

export type CaughtEvent = {
  providerId: string;
  gapStartedAt: string;
  incidentId: string;
  incidentTitle: string;
  leadMinutes: number;
};

type ProbeOutcome = {
  providerId: string;
  errorCode?: string;
};

async function officialLooksOperational(providerId: string): Promise<boolean> {
  try {
    const db = getDb();
    const doc = await db.collection('provider_status').doc(providerId).get();
    if (!doc.exists) return true;
    const data = doc.data() || {};
    return data.status === 'operational' && Number(data.activeIncidentCount || 0) === 0;
  } catch {
    // If we can't read the official view, don't make a "before they admitted it" claim.
    return false;
  }
}

// Called from the probe crons with the outcome of each real probe.
export async function updateGapState(outcomes: ProbeOutcome[]): Promise<void> {
  const db = getDb();
  for (const outcome of outcomes) {
    try {
      const stateRef = db.collection('gap_state').doc(outcome.providerId);
      const stateDoc = await stateRef.get();
      const state = stateDoc.exists ? stateDoc.data() || {} : {};
      const failed = Boolean(outcome.errorCode);
      const nowIso = new Date().toISOString();

      if (failed) {
        const consecutiveFails = Number(state.consecutiveFails || 0) + 1;
        const firstFailAt = consecutiveFails === 1 ? nowIso : state.firstFailAt || nowIso;
        let openGapId = state.openGapId || null;

        if (!openGapId && consecutiveFails >= CONSECUTIVE_FAILS_TO_OPEN) {
          if (await officialLooksOperational(outcome.providerId)) {
            const gapRef = await db.collection('gap_events').add({
              providerId: outcome.providerId,
              startedAt: firstFailAt,
              open: true,
              failCount: consecutiveFails,
              lastErrorCode: outcome.errorCode || null,
              createdAt: FieldValue.serverTimestamp(),
            });
            openGapId = gapRef.id;
            log('info', 'Gap opened: probes failing while official page is green', {
              providerId: outcome.providerId,
              gapId: openGapId,
            });
          }
        } else if (openGapId) {
          await db.collection('gap_events').doc(openGapId).set(
            { failCount: consecutiveFails, lastErrorCode: outcome.errorCode || null },
            { merge: true }
          );
        }

        await stateRef.set(
          { providerId: outcome.providerId, consecutiveFails, firstFailAt, openGapId, lastAt: nowIso },
          { merge: true }
        );
      } else {
        if (state.openGapId) {
          await db.collection('gap_events').doc(state.openGapId).set(
            { open: false, closedAt: nowIso },
            { merge: true }
          );
          log('info', 'Gap closed: probes recovered', {
            providerId: outcome.providerId,
            gapId: state.openGapId,
          });
        }
        await stateRef.set(
          { providerId: outcome.providerId, consecutiveFails: 0, firstFailAt: null, openGapId: null, lastAt: nowIso },
          { merge: true }
        );
      }
    } catch (error) {
      log('warn', 'Gap state update failed', { providerId: outcome.providerId, error });
    }
  }
}

export async function getOpenGap(providerId: string): Promise<OpenGap | null> {
  try {
    const db = getDb();
    const stateDoc = await db.collection('gap_state').doc(providerId).get();
    const openGapId = stateDoc.exists ? stateDoc.data()?.openGapId : null;
    if (!openGapId) return null;
    const gapDoc = await db.collection('gap_events').doc(openGapId).get();
    if (!gapDoc.exists || !gapDoc.data()?.open) return null;
    const data = gapDoc.data() || {};
    return {
      id: gapDoc.id,
      providerId,
      startedAt: String(data.startedAt || ''),
      failCount: Number(data.failCount || 0),
      lastErrorCode: data.lastErrorCode || undefined,
    };
  } catch {
    return null;
  }
}

export async function getOpenGaps(): Promise<OpenGap[]> {
  try {
    const db = getDb();
    const snapshot = await db.collection('gap_events').where('open', '==', true).limit(20).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        providerId: String(data.providerId || ''),
        startedAt: String(data.startedAt || ''),
        failCount: Number(data.failCount || 0),
        lastErrorCode: data.lastErrorCode || undefined,
      };
    });
  } catch {
    return [];
  }
}

// Closed gaps that a later official incident confirms: the bragging rights.
export async function getRecentCaughtEvents(limit = 3): Promise<CaughtEvent[]> {
  try {
    const db = getDb();
    const snapshot = await db
      .collection('gap_events')
      .orderBy('startedAt', 'desc')
      .limit(12)
      .get();
    const results: CaughtEvent[] = [];
    for (const doc of snapshot.docs) {
      if (results.length >= limit) break;
      const gap = doc.data();
      if (gap.open) continue;
      const match = await matchOfficialAck(String(gap.providerId), String(gap.startedAt));
      if (match) results.push({ providerId: String(gap.providerId), gapStartedAt: String(gap.startedAt), ...match });
    }
    return results;
  } catch {
    return [];
  }
}

async function matchOfficialAck(
  providerId: string,
  gapStartedAt: string
): Promise<{ incidentId: string; incidentTitle: string; leadMinutes: number } | null> {
  const gapStart = Date.parse(gapStartedAt);
  if (!Number.isFinite(gapStart)) return null;
  try {
    const incidents = await intelligenceService.getIncidents({ providerId, limit: 50 });
    for (const incident of incidents) {
      const ackAt = Date.parse(incident.startedAt || incident.updatedAt || '');
      if (!Number.isFinite(ackAt)) continue;
      if (ackAt >= gapStart && ackAt - gapStart <= ACK_MATCH_WINDOW_MS) {
        const leadMinutes = Math.round((ackAt - gapStart) / 60000);
        if (leadMinutes >= MIN_LEAD_MINUTES) {
          return {
            incidentId: `${incident.providerId}:${incident.id}`,
            incidentTitle: incident.title,
            leadMinutes,
          };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// For an incident page: did our probes see this before the provider said so?
export async function getCaughtBadgeForIncident(
  providerId: string,
  incidentStartedAt: string
): Promise<{ leadMinutes: number } | null> {
  const ackAt = Date.parse(incidentStartedAt);
  if (!Number.isFinite(ackAt)) return null;
  try {
    const db = getDb();
    const snapshot = await db
      .collection('gap_events')
      .where('providerId', '==', providerId)
      .limit(20)
      .get();
    for (const doc of snapshot.docs) {
      const gapStart = Date.parse(String(doc.data().startedAt || ''));
      if (!Number.isFinite(gapStart)) continue;
      if (gapStart <= ackAt && ackAt - gapStart <= ACK_MATCH_WINDOW_MS) {
        const leadMinutes = Math.round((ackAt - gapStart) / 60000);
        if (leadMinutes >= MIN_LEAD_MINUTES) return { leadMinutes };
      }
    }
    return null;
  } catch {
    return null;
  }
}
