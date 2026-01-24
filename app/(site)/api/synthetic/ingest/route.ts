import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';
import { config } from '@/lib/config';

const REQUIRED_FIELDS = ['providerId', 'model', 'endpoint', 'region', 'latencyMs'];

export async function POST(req: Request) {
  try {
    if (config.insights.probeSecret) {
      const secret = req.headers.get('x-probe-secret');
      if (secret !== config.insights.probeSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const payload = await req.json();
    for (const field of REQUIRED_FIELDS) {
      if (!(field in payload)) {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }

    await insightsService.ingestSynthetic({
      providerId: payload.providerId,
      model: payload.model,
      endpoint: payload.endpoint,
      region: payload.region,
      tier: payload.tier || 'unknown',
      streaming: Boolean(payload.streaming),
      latencyMs: Number(payload.latencyMs),
      latencyP50: payload.latencyP50,
      latencyP95: payload.latencyP95,
      latencyP99: payload.latencyP99,
      http5xxRate: payload.http5xxRate,
      http429Rate: payload.http429Rate,
      tokensPerSec: payload.tokensPerSec,
      streamDisconnectRate: payload.streamDisconnectRate,
      errorCode: payload.errorCode,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to ingest synthetic probe' }, { status: 500 });
  }
}
