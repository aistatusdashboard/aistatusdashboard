import { NextRequest, NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';
import { runRealProviderProbes } from '@/lib/services/provider-probes';
import { log } from '@/lib/utils/logger';
import { normalizeProbeRegion } from '@/lib/utils/probe-region';

export const dynamic = 'force-dynamic';

function requireCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET || process.env.APP_CRON_SECRET;
  const allowOpen = process.env.APP_ALLOW_OPEN_CRON === 'true';
  const isProd = process.env.NODE_ENV === 'production';
  const requireInDev = process.env.APP_REQUIRE_CRON_SECRET === 'true';

  if (!isProd && !requireInDev) return null;
  if (allowOpen) return null;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is required in production (set APP_ALLOW_OPEN_CRON=true to override).' },
      { status: 503 }
    );
  }

  const headerSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  const provided = bearer || headerSecret;

  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authResponse = requireCronAuth(request);
  if (authResponse) return authResponse;

  if (process.env.PROBE_REAL_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Real probes disabled. Set PROBE_REAL_ENABLED=true to enable.' },
      { status: 503 }
    );
  }

  try {
    const regionOverride = normalizeProbeRegion(
      request.headers.get('x-probe-region') || request.nextUrl.searchParams.get('region')
    );
    const summary = await runRealProviderProbes({ regionOverride: regionOverride || undefined });
    let ingested = 0;
    for (const event of summary.events) {
      await insightsService.ingestSynthetic(event);
      ingested += 1;
    }

    return NextResponse.json({
      success: true,
      region: regionOverride || 'global',
      ingested,
      skipped: summary.skipped,
      failures: summary.failures,
    });
  } catch (error) {
    log('error', 'Real provider probe cron failed', { error });
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
