jest.mock('@/lib/db/firestore', () => {
  const makeQuery = (docs: any[]) => {
    const query = {
      where: jest.fn(() => query),
      limit: jest.fn(() => query),
      get: jest.fn(async () => ({
        empty: docs.length === 0,
        docs: docs.map((data) => ({ data: () => data })),
      })),
    };
    return query;
  };

  return {
    getDb: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn((id: string) => ({
          get: jest.fn(async () => {
            if (id === 'openai:incident-123') {
              return {
                exists: true,
                data: () => ({
                  providerId: 'openai',
                  id: 'incident-123',
                  title: 'API degraded',
                  status: 'investigating',
                  startedAt: '2026-05-27T00:00:00.000Z',
                  updatedAt: '2026-05-27T00:10:00.000Z',
                }),
              };
            }
            return { exists: false, data: () => null };
          }),
        })),
        where: jest.fn((field: string, _op: string, value: string) => {
          if (field === 'id' && value === 'incident/with/slash') {
            return makeQuery([
              {
                providerId: 'openai',
                id: 'incident/with/slash',
                title: 'Regional outage',
                status: 'degraded',
                startedAt: '2026-05-27T00:00:00.000Z',
                updatedAt: '2026-05-27T00:10:00.000Z',
              },
            ]);
          }
          return makeQuery([]);
        }),
      })),
    })),
  };
});

import { getIncidentById } from '@/lib/services/public-data';

describe('getIncidentById', () => {
  it('returns a direct document match', async () => {
    const incident = await getIncidentById('openai:incident-123');
    expect(incident).toBeTruthy();
    expect(incident?.incident_id).toBe('openai:incident-123');
  });

  it('does not throw for slash-containing ids and falls back to query', async () => {
    const incident = await getIncidentById('incident/with/slash');
    expect(incident).toBeTruthy();
    expect(incident?.id).toBe('incident/with/slash');
  });
});
