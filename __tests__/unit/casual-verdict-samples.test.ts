// Character.AI has no official status feed and only one probe endpoint, so
// it can never collect three samples in the 30-minute window. A successful
// request is proof of "up" on its own; a lone failure is not proof of "down".
jest.mock('@/lib/db/firestore', () => ({
  __esModule: true,
  getDb: jest.fn(() => ({
    collection: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(async () => ({ docs: [] })),
    })),
  })),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') },
  Timestamp: { fromDate: jest.fn((value: Date) => value) },
}));

const rollup: any[] = [];
jest.mock('@/lib/services/probe-store', () => ({
  __esModule: true,
  readProbeRollup: jest.fn(async () => rollup),
}));

jest.mock('@/lib/services/intelligence', () => ({
  __esModule: true,
  intelligenceService: {
    getIncidents: jest.fn(async () => []),
    getProviderSummaries: jest.fn(async () => []),
  },
}));

jest.mock('@/lib/services/gap-detector', () => ({
  __esModule: true,
  getOpenGaps: jest.fn(async () => []),
}));


function probe(minutesAgo: number, extra: Record<string, unknown> = {}) {
  const at = new Date(Date.now() - minutesAgo * 60_000);
  return {
    providerId: 'character-ai',
    model: 'web',
    endpoint: 'web',
    region: 'global',
    timestamp: { toDate: () => at, toMillis: () => at.getTime() },
    latencyMs: 250,
    ...extra,
  };
}

describe('casual verdict with thin samples', () => {
  // casual.ts caches probe reads per minute; a fresh module per test keeps
  // one test's rollup from answering the next.
  let getCasualStatus: typeof import('@/lib/services/casual').getCasualStatus;
  beforeEach(() => {
    rollup.length = 0;
    jest.resetModules();
    getCasualStatus = require('@/lib/services/casual').getCasualStatus;
  });

  it('calls a single successful probe "up"', async () => {
    rollup.push(probe(5));
    const status = await getCasualStatus({ appId: 'character-ai' });
    expect(status?.overall_status).toBe('operational');
  });

  it('does not call a single failed probe "down"', async () => {
    rollup.push(probe(5, { errorCode: 'timeout' }));
    const status = await getCasualStatus({ appId: 'character-ai' });
    expect(status?.overall_status).toBe('unknown');
  });

  it('calls three consecutive timeouts "down" even without an HTTP status', async () => {
    rollup.push(probe(5, { errorCode: 'timeout' }), probe(20, { errorCode: 'timeout' }), probe(25, { errorCode: 'timeout' }));
    const status = await getCasualStatus({ appId: 'character-ai' });
    expect(status?.overall_status).toBe('down');
  });

  it('stays "unknown" with no samples and no official feed', async () => {
    const status = await getCasualStatus({ appId: 'character-ai' });
    expect(status?.overall_status).toBe('unknown');
  });
});
