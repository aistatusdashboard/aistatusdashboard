import { NextRequest } from 'next/server';
import { queryMetrics } from '@/lib/services/public-data';
import { jsonResponse, buildResponseMeta } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric');
  if (!metric) {
    const meta = buildResponseMeta({ evidence: [], confidence: 0 });
    return jsonResponse(
      request,
      {
        ...meta,
        data: { error: 'metric is required' },
      },
      { cacheSeconds: 0, status: 400 }
    );
  }

  const payload = await queryMetrics({
    metric: metric as any,
    providerId: searchParams.get('provider') || undefined,
    surface: searchParams.get('surface') || undefined,
    model: searchParams.get('model') || undefined,
    region: searchParams.get('region') || undefined,
    since: searchParams.get('since') || undefined,
    until: searchParams.get('until') || undefined,
    granularitySeconds: searchParams.get('granularity_seconds')
      ? Number(searchParams.get('granularity_seconds'))
      : undefined,
  });

  const meta = buildResponseMeta({ evidence: payload.evidence, confidence: payload.confidence });
  return jsonResponse(
    request,
    {
      ...meta,
      data: payload.data,
    },
    { cacheSeconds: 60 }
  );
}
