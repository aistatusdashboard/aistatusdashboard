import { NextRequest } from 'next/server';
import { generatePolicy } from '@/lib/services/public-data';
import { jsonResponse, buildResponseMeta } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    const meta = buildResponseMeta({ evidence: [], confidence: 0 });
    return jsonResponse(
      request,
      {
        ...meta,
        data: { error: 'invalid_json' },
      },
      { cacheSeconds: 0, status: 400 }
    );
  }

  if (!payload?.model || !payload?.endpoint || !payload?.region) {
    const meta = buildResponseMeta({ evidence: [], confidence: 0 });
    return jsonResponse(
      request,
      {
        ...meta,
        data: { error: 'model, endpoint, and region are required' },
      },
      { cacheSeconds: 0, status: 400 }
    );
  }

  const result = await generatePolicy({
    providerId: payload.provider,
    model: payload.model,
    endpoint: payload.endpoint,
    region: payload.region,
    tier: payload.tier,
    streaming: payload.streaming,
    objective: payload.objective,
  });

  const meta = buildResponseMeta({ evidence: result.evidence, confidence: result.confidence });
  return jsonResponse(
    request,
    {
      ...meta,
      data: result.data,
    },
    { cacheSeconds: 30 }
  );
}
