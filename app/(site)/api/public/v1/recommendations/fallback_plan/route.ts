import { NextRequest } from 'next/server';
import { buildFallbackPlan } from '@/lib/services/public-data';
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

  const result = await buildFallbackPlan({
    providerId: payload.provider,
    model: payload.model,
    endpoint: payload.endpoint,
    region: payload.region,
    tier: payload.tier,
    streaming: payload.streaming,
    signal: payload.signal,
    latencyP50: payload.latency_p50_ms,
    latencyP95: payload.latency_p95_ms,
    latencyP99: payload.latency_p99_ms,
    http5xxRate: payload.http_5xx_rate,
    http429Rate: payload.http_429_rate,
    tokensPerSec: payload.tokens_per_sec,
    streamDisconnectRate: payload.stream_disconnect_rate,
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
