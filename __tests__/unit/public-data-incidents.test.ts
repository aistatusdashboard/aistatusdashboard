jest.mock('@/lib/services/intelligence', () => ({
  intelligenceService: {
    getIncidents: jest.fn(),
  },
}));

import { searchIncidents } from '@/lib/services/public-data';
import { intelligenceService } from '@/lib/services/intelligence';

describe('public-data incident normalization', () => {
  it('maps active incidents with unknown status to investigating', async () => {
    (intelligenceService.getIncidents as jest.Mock).mockResolvedValue([
      {
        id: 'abc',
        providerId: 'azure-openai',
        title: 'Elevated Error Rates',
        status: 'unknown',
        severity: 'degraded',
        startedAt: '2026-05-29T00:00:00.000Z',
        updatedAt: '2026-05-29T00:10:00.000Z',
        updates: [],
      },
    ]);

    const payload = await searchIncidents({ activeOnly: true, limit: 10 });
    expect(payload.data.incidents).toHaveLength(1);
    expect(payload.data.incidents[0].status).toBe('investigating');
  });
});
