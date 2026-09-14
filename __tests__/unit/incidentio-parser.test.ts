import { parseIncidentIoIncident, parseIncidentIoSummary } from '@/lib/utils/incidentio-parser';

const SUMMARY = {
  summary: {
    components: [
      { id: 'c-web', name: 'Website' },
      { id: 'c-api', name: 'API' },
    ],
    affected_components: [{ component_id: 'c-api', status: 'partial_outage' }],
    ongoing_incidents: [{ id: 'i-1' }],
  },
};

const INCIDENT = {
  id: 'i-1',
  name: 'Connector errors',
  type: 'incident',
  status: 'resolved',
  published_at: '2026-09-05T04:50:00Z',
  affected_components: [{ component_id: 'c-api', status: 'partial_outage', current_status: 'operational' }],
  component_impacts: [{ start_at: '2026-09-05T04:50:00Z', end_at: '2026-09-05T07:09:00Z', status: 'partial_outage' }],
  updates: [
    { id: 'u-1', published_at: '2026-09-05T04:50:00Z', message_string: 'Investigating.', to_status: 'identified' },
    { id: 'u-2', published_at: '2026-09-05T07:09:00Z', message_string: 'Resolved.', to_status: 'resolved' },
  ],
};

describe('incident.io parser', () => {
  it('maps affected components onto the component list and rolls up status', () => {
    const parsed = parseIncidentIoSummary('perplexity', SUMMARY);
    expect(parsed.components.map((c) => [c.name, c.status])).toEqual([
      ['Website', 'operational'],
      ['API', 'partial_outage'],
    ]);
    expect(parsed.status).toBe('partial_outage');
    expect(parsed.ongoing).toBe(1);
  });

  it('reads a green page as operational', () => {
    expect(parseIncidentIoSummary('perplexity', { summary: { components: [{ id: 'a', name: 'A' }] } }).status).toBe('operational');
  });

  it('normalizes an incident with its timeline', () => {
    const names = new Map([['c-api', 'API']]);
    const incident = parseIncidentIoIncident('perplexity', 'perplexity-incidentio', names, INCIDENT, 'https://status.perplexity.com');
    expect(incident).toMatchObject({
      id: 'i-1',
      status: 'resolved',
      severity: 'partial_outage',
      startedAt: '2026-09-05T04:50:00.000Z',
      updatedAt: '2026-09-05T07:09:00.000Z',
      resolvedAt: '2026-09-05T07:09:00.000Z',
      impactedComponentNames: ['API'],
      rawUrl: 'https://status.perplexity.com/incidents/i-1',
    });
    expect(incident?.updates).toHaveLength(2);
    expect(incident?.updates[1].status).toBe('resolved');
  });

  it('marks maintenance_complete as resolved maintenance', () => {
    const m = parseIncidentIoIncident('perplexity', 's', new Map(), { ...INCIDENT, id: 'm', type: 'maintenance', status: 'maintenance_complete' });
    expect(m?.status).toBe('resolved');
    expect(m?.severity).toBe('maintenance');
  });
});
