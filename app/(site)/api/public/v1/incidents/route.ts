import { NextRequest } from 'next/server';
import { searchIncidents } from '@/lib/services/public-data';
import { jsonResponse, buildResponseMeta } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const payload = await searchIncidents({
    providerId: searchParams.get('provider') || undefined,
    severity: searchParams.get('severity') || undefined,
    activeOnly: searchParams.get('active_only') === 'true',
    since: searchParams.get('since') || undefined,
    until: searchParams.get('until') || undefined,
    region: searchParams.get('region') || undefined,
    model: searchParams.get('model') || undefined,
    query: searchParams.get('q') || undefined,
    cursor: searchParams.get('cursor') || undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  });

  const meta = buildResponseMeta({ evidence: payload.evidence, confidence: payload.confidence });
  return jsonResponse(
    request,
    {
      ...meta,
      data: payload.data,
    },
    { cacheSeconds: 30 }
  );
}
