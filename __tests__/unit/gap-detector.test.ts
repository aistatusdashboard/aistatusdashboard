jest.mock('@/lib/db/firestore', () => ({
  getDb: jest.fn(),
}));
jest.mock('@/lib/services/intelligence', () => ({
  intelligenceService: { getIncidents: jest.fn() },
}));

import { updateGapState } from '@/lib/services/gap-detector';
import { getDb } from '@/lib/db/firestore';

type DocStore = Record<string, Record<string, any>>;

function makeDb(store: DocStore) {
  let addCounter = 0;
  const collection = (name: string) => ({
    doc: (id: string) => ({
      get: async () => {
        const data = store[`${name}/${id}`];
        return { exists: Boolean(data), data: () => data };
      },
      set: async (data: any, opts?: { merge?: boolean }) => {
        const key = `${name}/${id}`;
        store[key] = opts?.merge ? { ...(store[key] || {}), ...data } : data;
      },
    }),
    add: async (data: any) => {
      addCounter += 1;
      const id = `gen-${addCounter}`;
      store[`${name}/${id}`] = data;
      return { id };
    },
  });
  return { collection };
}

describe('gap detector', () => {
  let store: DocStore;

  beforeEach(() => {
    store = {};
    (getDb as jest.Mock).mockReturnValue(makeDb(store));
  });

  it('does not open a gap on a single failure', async () => {
    store['provider_status/openai'] = { status: 'operational', activeIncidentCount: 0 };
    await updateGapState([{ providerId: 'openai', errorCode: 'http-500' }]);
    expect(store['gap_state/openai'].consecutiveFails).toBe(1);
    expect(store['gap_state/openai'].openGapId).toBeNull();
  });

  it('opens a gap after two consecutive failures while official is green', async () => {
    store['provider_status/openai'] = { status: 'operational', activeIncidentCount: 0 };
    await updateGapState([{ providerId: 'openai', errorCode: 'http-500' }]);
    await updateGapState([{ providerId: 'openai', errorCode: 'http-500' }]);
    const state = store['gap_state/openai'];
    expect(state.consecutiveFails).toBe(2);
    expect(state.openGapId).toBeTruthy();
    const gap = store[`gap_events/${state.openGapId}`];
    expect(gap.open).toBe(true);
    expect(gap.providerId).toBe('openai');
  });

  it('does not open a gap when the official page already shows an issue', async () => {
    store['provider_status/openai'] = { status: 'degraded', activeIncidentCount: 1 };
    await updateGapState([{ providerId: 'openai', errorCode: 'http-500' }]);
    await updateGapState([{ providerId: 'openai', errorCode: 'http-500' }]);
    expect(store['gap_state/openai'].openGapId).toBeNull();
  });

  it('never opens a gap for failures that are ours (no credit, bad key, quota)', async () => {
    // The six-day false "Claude is having issues": Anthropic returned 400 for
    // an empty credit balance and Mistral 429 for a rate-limited key.
    store['provider_status/anthropic'] = { status: 'operational', activeIncidentCount: 0 };
    for (let i = 0; i < 6; i++) {
      await updateGapState([
        { providerId: 'anthropic', errorCode: 'http-400', endpoint: 'messages', model: 'claude-haiku-4-5' },
        // The free probes pass every cycle; they must not reset the streak.
        { providerId: 'anthropic', endpoint: 'models', model: 'models' },
      ]);
    }
    expect(store['gap_state/anthropic'].openGapId ?? null).toBeNull();
    expect(store['gap_state/anthropic'].consecutiveFails ?? 0).toBe(0);
    expect(store['gap_state/anthropic'].misconfig['messages:claude-haiku-4-5'].streak).toBe(6);
  });

  it('closes an already-open gap once the failures turn out to be ours', async () => {
    store['provider_status/anthropic'] = { status: 'operational', activeIncidentCount: 0 };
    await updateGapState([{ providerId: 'anthropic', errorCode: 'http-500' }]);
    await updateGapState([{ providerId: 'anthropic', errorCode: 'http-500' }]);
    const gapId = store['gap_state/anthropic'].openGapId;
    expect(gapId).toBeTruthy();
    await updateGapState([{ providerId: 'anthropic', errorCode: 'http-400' }]);
    expect(store[`gap_events/${gapId}`].open).toBe(false);
  });

  it('closes the gap when a probe succeeds again', async () => {
    store['provider_status/openai'] = { status: 'operational', activeIncidentCount: 0 };
    await updateGapState([{ providerId: 'openai', errorCode: 'http-500' }]);
    await updateGapState([{ providerId: 'openai', errorCode: 'http-500' }]);
    const gapId = store['gap_state/openai'].openGapId;
    await updateGapState([{ providerId: 'openai' }]);
    expect(store['gap_state/openai'].openGapId).toBeNull();
    expect(store['gap_state/openai'].consecutiveFails).toBe(0);
    expect(store[`gap_events/${gapId}`].open).toBe(false);
    expect(store[`gap_events/${gapId}`].closedAt).toBeTruthy();
  });
});
