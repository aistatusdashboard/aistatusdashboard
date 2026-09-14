import { Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/db/firestore';
import { ProviderStatus } from '@/lib/types';
import { log } from '@/lib/utils/logger';

// Decides whether a provider's status deserves an email.
//
// Before this existed, every 5-minute check that differed from the previous
// one sent an email: a single failed fetch ("unknown") produced "Manus is
// unknown" followed by "Manus is operational" five minutes later, and one
// subscriber received eight alerts in a night. The rules now:
//
//  - "unknown" means WE could not read the feed. It is never announced and
//    never ends an incident.
//  - A state must persist before it is announced: an outage for 10 minutes,
//    degradation for 30, and a recovery for 10.
//  - A recovery is only announced if the incident it ends was announced.
//
// State lives in alert_state/{providerId}.

const COLLECTION = 'alert_state';
const MINUTE = 60 * 1000;

type Severity = 0 | 1 | 2;

function severity(status: ProviderStatus | string): Severity | null {
    switch (status) {
        case 'operational':
        case 'maintenance':
            return 0;
        case 'degraded':
        case 'partial_outage':
            return 1;
        case 'down':
        case 'major_outage':
            return 2;
        default:
            return null; // unknown / unreachable
    }
}

function requiredPersistenceMs(next: Severity): number {
    if (next === 2) return 10 * MINUTE;
    if (next === 1) return 30 * MINUTE;
    return 10 * MINUTE; // recovery
}

export type AlertDecision =
    | { notify: false }
    | { notify: true; from: ProviderStatus; to: ProviderStatus };

type AlertStateDoc = {
    alertedStatus?: string;
    candidateStatus?: string | null;
    candidateSince?: Timestamp | null;
};

export async function evaluateAlert(
    providerId: string,
    current: ProviderStatus,
    now: Date = new Date()
): Promise<AlertDecision> {
    const currentSeverity = severity(current);
    if (currentSeverity === null) return { notify: false };

    const db = getDb();
    const ref = db.collection(COLLECTION).doc(providerId);
    let state: AlertStateDoc = {};
    try {
        const snapshot = await ref.get();
        if (snapshot.exists) state = (snapshot.data() as AlertStateDoc) || {};
    } catch (error) {
        log('warn', 'alert_state read failed; suppressing alert this cycle', { error, providerId });
        return { notify: false };
    }

    const alertedStatus = (state.alertedStatus as ProviderStatus) || 'operational';
    const alertedSeverity = severity(alertedStatus) ?? 0;

    // Nothing new relative to what subscribers were last told.
    if (currentSeverity === alertedSeverity) {
        if (state.candidateStatus) {
            await ref.set({ candidateStatus: null, candidateSince: null }, { merge: true });
        }
        return { notify: false };
    }

    // A different state: start (or continue) the persistence clock.
    if (state.candidateStatus !== current || !state.candidateSince) {
        await ref.set(
            { candidateStatus: current, candidateSince: Timestamp.fromDate(now) },
            { merge: true }
        );
        return { notify: false };
    }

    const heldMs = now.getTime() - state.candidateSince.toDate().getTime();
    if (heldMs < requiredPersistenceMs(currentSeverity)) return { notify: false };

    await ref.set(
        {
            alertedStatus: current,
            alertedAt: Timestamp.fromDate(now),
            candidateStatus: null,
            candidateSince: null,
        },
        { merge: true }
    );
    return { notify: true, from: alertedStatus, to: current };
}
