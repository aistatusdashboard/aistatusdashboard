import { NextRequest } from 'next/server';
import { getStatusSummary } from '@/lib/services/public-data';
import { jsonResponse, buildResponseMeta } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const payload = await getStatusSummary({});
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
