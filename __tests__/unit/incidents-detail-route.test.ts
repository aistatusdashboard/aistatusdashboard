/** @jest-environment node */

jest.mock('@/lib/services/public-data', () => ({
  getIncidentById: jest.fn(),
}));

import { GET } from '@/app/(site)/api/public/v1/incidents/[incident_id]/route';
import { getIncidentById } from '@/lib/services/public-data';

describe('incident detail route', () => {
  it('decodes encoded incident ids before lookup', async () => {
    (getIncidentById as jest.Mock).mockResolvedValue({
      providerId: 'openai',
      id: 'incident-123',
      incident_id: 'openai:incident-123',
      startedAt: '2026-05-27T00:00:00.000Z',
      updatedAt: '2026-05-27T00:10:00.000Z',
      rawUrl: 'https://status.example/incident-123',
      title: 'API degraded',
      status: 'investigating',
    });

    const request = new Request(
      'https://aistatusdashboard.com/api/public/v1/incidents/openai%3Aincident-123'
    );

    const response = await GET(request, {
      params: Promise.resolve({ incident_id: 'openai%3Aincident-123' }),
    } as any);

    expect(getIncidentById).toHaveBeenCalledWith('openai:incident-123');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body?.data?.incident_id).toBe('openai:incident-123');
  });
});
