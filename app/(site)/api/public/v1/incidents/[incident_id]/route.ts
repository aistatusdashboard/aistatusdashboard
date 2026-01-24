import { NextRequest } from 'next/server';
import { getIncidentById } from '@/lib/services/public-data';
import { jsonResponse, buildResponseMeta } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { incident_id: string } }) {
  const incident = await getIncidentById(params.incident_id);
  if (!incident) {
    const meta = buildResponseMeta({ evidence: [], confidence: 0 });
    return jsonResponse(
      request,
      {
        ...meta,
        data: { error: 'incident not found' },
      },
      { cacheSeconds: 0, status: 404 }
    );
  }
  const meta = buildResponseMeta({
    evidence: [
      {
        source_url: incident.rawUrl,
        ids: [incident.incident_id],
        metric_window: {
          since: incident.startedAt,
          until: incident.updatedAt,
        },
      },
    ],
    confidence: 0.8,
  });
  return jsonResponse(
    request,
    {
      ...meta,
      data: incident,
    },
    { cacheSeconds: 60 }
  );
}
