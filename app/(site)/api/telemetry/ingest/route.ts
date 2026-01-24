import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';
import { config } from '@/lib/config';

const REQUIRED_FIELDS = ['clientId', 'providerId', 'model', 'endpoint', 'region', 'latencyMs'];

export async function POST(req: Request) {
  try {
    const allowPublic = process.env.APP_ALLOW_PUBLIC_TELEMETRY === 'true';
    const publicKey = process.env.TELEMETRY_PUBLIC_KEY || process.env.APP_TELEMETRY_PUBLIC_KEY;
    const secret = req.headers.get('x-telemetry-secret');
    const publicHeader = req.headers.get('x-telemetry-key');

    if (config.insights.telemetrySecret) {
      if (secret !== config.insights.telemetrySecret) {
        if (!allowPublic && (!publicKey || publicHeader !== publicKey)) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }
    } else if (!allowPublic && publicKey && publicHeader !== publicKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    for (const field of REQUIRED_FIELDS) {
      if (!(field in payload)) {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }

    await insightsService.ingestTelemetry({
      clientId: payload.clientId,
      accountId: payload.accountId,
      source: payload.source,
      providerId: payload.providerId,
      model: payload.model,
      endpoint: payload.endpoint,
      region: payload.region,
      tier: payload.tier || 'unknown',
      streaming: Boolean(payload.streaming),
      latencyMs: Number(payload.latencyMs),
      http5xxRate: payload.http5xxRate,
      http429Rate: payload.http429Rate,
      retryAfterMs: payload.retryAfterMs,
      throttleReason: payload.throttleReason,
      tokensPerSec: payload.tokensPerSec,
      streamDisconnectRate: payload.streamDisconnectRate,
      refusalRate: payload.refusalRate,
      toolSuccessRate: payload.toolSuccessRate,
      schemaValidRate: payload.schemaValidRate,
      completionLength: payload.completionLength,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to ingest telemetry' }, { status: 500 });
  }
}
