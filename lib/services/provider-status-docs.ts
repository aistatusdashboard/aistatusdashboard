import { getDb } from '@/lib/db/firestore';

// One read of the providers' current official statuses, shared by everything
// that runs at the end of an ingest cycle (the 30-day tally and the alerts).
export type ProviderStatusDoc = {
  id: string;
  status?: string;
  appStatus: Record<string, string | null>;
  lastUpdatedMs: number;
};

export async function loadProviderStatusDocs(): Promise<ProviderStatusDoc[]> {
  const snapshot = await getDb().collection('provider_status').get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      status: typeof data.status === 'string' ? data.status : undefined,
      appStatus: data.appStatus && typeof data.appStatus === 'object' ? data.appStatus : {},
      lastUpdatedMs: data.lastUpdated?.toDate?.()?.getTime?.() ?? NaN,
    };
  });
}
