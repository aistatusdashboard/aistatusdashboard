// The verdict is the provider's own reported status — nothing else.
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

const summaries: any[] = [];
const incidents: any[] = [];
jest.mock('@/lib/services/intelligence', () => ({
  __esModule: true,
  intelligenceService: {
    getIncidents: jest.fn(async () => incidents),
    getProviderSummaries: jest.fn(async () => summaries),
  },
}));

import { getCasualStatus } from '@/lib/services/casual';

function official(providerId: string, status: string, minutesAgo = 1) {
  return { providerId, status, description: 'x', lastUpdated: new Date(Date.now() - minutesAgo * 60_000).toISOString() };
}

describe('casual verdict mirrors the official status', () => {
  beforeEach(() => {
    summaries.length = 0;
    incidents.length = 0;
  });

  it('operational page → up', async () => {
    summaries.push(official('openai', 'operational'));
    expect((await getCasualStatus({ appId: 'chatgpt' }))?.overall_status).toBe('operational');
  });

  it('degraded page → degraded, major outage → down', async () => {
    summaries.push(official('openai', 'degraded'));
    expect((await getCasualStatus({ appId: 'chatgpt' }))?.overall_status).toBe('degraded');
    summaries[0] = official('openai', 'major_outage');
    expect((await getCasualStatus({ appId: 'chatgpt' }))?.overall_status).toBe('down');
  });

  it('a page we have not managed to read for two hours → unknown', async () => {
    summaries.push(official('openai', 'operational', 180));
    expect((await getCasualStatus({ appId: 'chatgpt' }))?.overall_status).toBe('unknown');
  });

  it('no reading at all → unknown, never up', async () => {
    expect((await getCasualStatus({ appId: 'chatgpt' }))?.overall_status).toBe('unknown');
  });

  it('a provider with only a public endpoint is judged by that endpoint alone', async () => {
    summaries.push(official('character-ai', 'operational'));
    const status = await getCasualStatus({ appId: 'character-ai' });
    expect(status?.overall_status).toBe('operational');
    expect(status?.official_page.exists).toBe(true);
  });
});
