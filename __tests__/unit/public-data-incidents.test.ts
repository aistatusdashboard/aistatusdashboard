jest.mock('@/lib/services/intelligence', () => ({
  intelligenceService: {
    getIncidents: jest.fn(),
  },
}));

import { searchIncidents } from '@/lib/services/public-data';
import { intelligenceService } from '@/lib/services/intelligence';

describe('public-data incident normalization', () => {
  it('maps active incidents with unknown status to investigating', async () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    (intelligenceService.getIncidents as jest.Mock).mockResolvedValue([
      {
        id: 'abc',
        providerId: 'azure-openai',
        title: 'Elevated Error Rates',
        status: 'unknown',
        severity: 'degraded',
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        updatedAt: recent,
        updates: [],
      },
    ]);

    const payload = await searchIncidents({ activeOnly: true, limit: 10 });
    expect(payload.data.incidents).toHaveLength(1);
    expect(payload.data.incidents[0].status).toBe('investigating');
  });

  it('drops zombie incidents with no update in 24h from active results', async () => {
    (intelligenceService.getIncidents as jest.Mock).mockResolvedValue([
      {
        id: 'old',
        providerId: 'openai',
        title: 'Stuck investigating incident',
        status: 'investigating',
        severity: 'degraded',
        startedAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T03:38:18.000Z',
        updates: [],
      },
    ]);

    const payload = await searchIncidents({ activeOnly: true, limit: 10 });
    expect(payload.data.incidents).toHaveLength(0);
  });

  it('treats a resolvedAt timestamp as resolved even when status is unknown', async () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    (intelligenceService.getIncidents as jest.Mock).mockResolvedValue([
      {
        id: 'goog',
        providerId: 'google-ai',
        title: 'Multi-product degradation',
        status: 'unknown',
        severity: 'degraded',
        startedAt: recent,
        updatedAt: recent,
        resolvedAt: recent,
        updates: [],
      },
    ]);

    const payload = await searchIncidents({ activeOnly: true, limit: 10 });
    expect(payload.data.incidents).toHaveLength(0);
  });
});
