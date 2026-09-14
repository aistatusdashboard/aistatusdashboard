import { parseRootlySnapshot } from '@/lib/utils/rootly-parser';
import type { BrowserFeedSnapshot } from '@/lib/services/feed-snapshots';

function snapshot(overrides: Partial<BrowserFeedSnapshot> = {}): BrowserFeedSnapshot {
  return {
    sourceId: 'mistral-rootly',
    providerId: 'mistral',
    platform: 'rootly',
    fetchedAt: new Date().toISOString(),
    overall: 'All Systems Operational',
    components: [
      { name: 'Completion API', status: 'Operational' },
      { name: 'OCR API', status: 'Operational' },
    ],
    incidents: [
      {
        id: '8eb8a3a6',
        url: 'https://status.mistral.ai/incidents/8eb8a3a6',
        title: 'GLM 5.2 Service Degraded',
        status: 'Resolved',
        message: 'We have rolled out our solution.',
        shownAt: '2026-09-10T16:50:00.000Z',
        durationMinutes: 24,
      },
    ],
    ...overrides,
  };
}

describe('parseRootlySnapshot', () => {
  it('reads a green page as operational with resolved history', () => {
    const parsed = parseRootlySnapshot(snapshot());
    expect(parsed.status).toBe('operational');
    expect(parsed.components).toHaveLength(2);
    expect(parsed.incidents[0]).toMatchObject({
      id: '8eb8a3a6',
      status: 'resolved',
      startedAt: '2026-09-10T16:26:00.000Z',
      updatedAt: '2026-09-10T16:50:00.000Z',
      resolvedAt: '2026-09-10T16:50:00.000Z',
      rawUrl: 'https://status.mistral.ai/incidents/8eb8a3a6',
    });
    expect(parsed.incidents[0].updates[0].body).toBe('We have rolled out our solution.');
  });

  it('flags an affected service and an open incident as degraded', () => {
    const parsed = parseRootlySnapshot(
      snapshot({
        overall: 'Some Systems Affected',
        components: [{ name: 'Completion API', status: 'Affected' }],
        incidents: [
          { id: 'x', title: 'Completion API Degraded', status: 'Investigating', shownAt: '2026-09-14T04:00:00.000Z' },
        ],
      })
    );
    expect(parsed.status).toBe('degraded');
    expect(parsed.incidents[0].status).toBe('investigating');
    expect(parsed.incidents[0].resolvedAt).toBeUndefined();
  });

  it('is unknown when the page rendered nothing usable', () => {
    const parsed = parseRootlySnapshot(snapshot({ overall: '', components: [], incidents: [] }));
    expect(parsed.status).toBe('unknown');
  });

  it('drops entries whose date could not be read', () => {
    const parsed = parseRootlySnapshot(
      snapshot({ incidents: [{ id: 'bad', title: 'Broken', status: 'Resolved', shownAt: 'not a date' }] })
    );
    expect(parsed.incidents).toHaveLength(0);
  });
});
