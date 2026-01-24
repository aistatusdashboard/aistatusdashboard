import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    if (!payload.model || !payload.endpoint || !payload.region) {
      return NextResponse.json({ error: 'Missing model, endpoint, or region' }, { status: 400 });
    }

    const plan = insightsService.buildFallbackPlan({
      model: payload.model,
      endpoint: payload.endpoint,
      region: payload.region,
      tier: payload.tier || 'unknown',
      streaming: Boolean(payload.streaming),
      signal: payload.signal || 'unknown',
      latencyP50: payload.latencyP50,
      latencyP95: payload.latencyP95,
      latencyP99: payload.latencyP99,
      http5xxRate: payload.http5xxRate,
      http429Rate: payload.http429Rate,
      tokensPerSec: payload.tokensPerSec,
      streamDisconnectRate: payload.streamDisconnectRate,
    });

    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate fallback plan' }, { status: 500 });
  }
}
