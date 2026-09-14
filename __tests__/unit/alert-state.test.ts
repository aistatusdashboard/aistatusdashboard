jest.mock('@/lib/db/firestore', () => ({
  getDb: jest.fn(),
}));

import { getDb } from '@/lib/db/firestore';
import { evaluateAlert } from '@/lib/services/alert-state';
import type { ProviderStatus } from '@/lib/types';

// Minimal in-memory stand-in for the one collection this module touches.
function makeDb(store: Record<string, any>) {
  const doc = (id: string) => ({
    get: async () => ({ exists: id in store, data: () => store[id] }),
    set: async (data: Record<string, any>, opts?: { merge?: boolean }) => {
      store[id] = opts?.merge ? { ...(store[id] || {}), ...data } : data;
    },
  });
  return { collection: () => ({ doc }) };
}

const MIN = 60_000;
const T0 = new Date('2026-09-13T00:00:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * MIN);

// Feed a sequence of 5-minute checks and collect what would be announced.
async function run(sequence: ProviderStatus[], store: Record<string, any> = {}) {
  (getDb as jest.Mock).mockReturnValue(makeDb(store));
  const announced: Array<{ minute: number; from: string; to: string }> = [];
  for (let i = 0; i < sequence.length; i++) {
    const decision = await evaluateAlert('openai', sequence[i], at(i * 5));
    if (decision.notify) announced.push({ minute: i * 5, from: decision.from, to: decision.to });
  }
  return announced;
}

describe('alert persistence', () => {
  it('ignores a single-check blip (the "Manus is unknown" email)', async () => {
    const out = await run(['operational', 'unknown', 'operational', 'operational', 'operational']);
    expect(out).toEqual([]);
  });

  it('ignores a five-minute real flap too', async () => {
    const out = await run(['operational', 'down', 'operational', 'operational', 'operational']);
    expect(out).toEqual([]);
  });

  it('announces an outage once it has held for 10 minutes, and the recovery once', async () => {
    const seq: ProviderStatus[] = ['operational', 'down', 'down', 'down', 'down', 'operational', 'operational', 'operational', 'operational'];
    const out = await run(seq);
    expect(out).toEqual([
      { minute: 15, from: 'operational', to: 'down' },
      { minute: 35, from: 'down', to: 'operational' },
    ]);
  });

  it('requires degradation to hold for 30 minutes', async () => {
    const seq: ProviderStatus[] = ['operational', ...Array<ProviderStatus>(6).fill('degraded'), 'operational', 'operational', 'operational'];
    // degraded seen at 5..30 → held 25 minutes at the 30-minute check: not yet.
    const out = await run(seq);
    expect(out).toEqual([]);
    const longer: ProviderStatus[] = ['operational', ...Array<ProviderStatus>(8).fill('degraded')];
    expect(await run(longer)).toEqual([{ minute: 35, from: 'operational', to: 'degraded' }]);
  });

  it('never announces a recovery for an incident it never announced', async () => {
    const out = await run(['operational', 'down', 'operational', 'operational', 'operational', 'operational']);
    expect(out).toEqual([]);
  });

  it('an unknown reading mid-incident does not end the incident', async () => {
    const store: Record<string, any> = {};
    const seq: ProviderStatus[] = ['operational', 'down', 'down', 'down', 'unknown', 'down', 'unknown', 'down'];
    const out = await run(seq, store);
    expect(out).toEqual([{ minute: 15, from: 'operational', to: 'down' }]);
    expect(store.openai.alertedStatus).toBe('down');
  });

  it('does not re-announce a state subscribers were already told about', async () => {
    const out = await run(Array<ProviderStatus>(12).fill('down'), { openai: { alertedStatus: 'down' } });
    expect(out).toEqual([]);
  });
});
