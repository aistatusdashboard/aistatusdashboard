import { NextRequest, NextResponse } from 'next/server';
import { providerService } from '@/lib/services/providers';
import { statusService } from '@/lib/services/status';
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

  try {
    const regionOverride = normalizeProbeRegion(
      request.headers.get('x-probe-region') || request.nextUrl.searchParams.get('region')
    );
    const providers = providerService.getProviders();
    const results = await Promise.allSettled(providers.map((provider) => statusService.checkProvider(provider)));

    let ingested = 0;
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const data = result.value;
      await insightsService.ingestSynthetic({
        providerId: data.id,
        model: 'status',
        endpoint: 'status',
        region: regionOverride || 'global',
        tier: 'unknown',
        streaming: false,
        latencyMs: data.responseTime,
      });
      ingested += 1;
    }

    let realSummary: {
      ingested: number;
      skipped: Array<{ providerId: string; reason: string }>;
      failures: Array<{ providerId: string; error: string }>;
    } | null = null;

    if (process.env.PROBE_REAL_ENABLED === 'true') {
      try {
        const summary = await runRealProviderProbes({ regionOverride: regionOverride || undefined });
        let ingestedReal = 0;
        for (const event of summary.events) {
          await insightsService.ingestSynthetic(event);
          ingestedReal += 1;
        }
        realSummary = { ingested: ingestedReal, skipped: summary.skipped, failures: summary.failures };
      } catch (error) {
        log('error', 'Real provider probe run failed', { error });
      }
    }

    return NextResponse.json({ success: true, region: regionOverride || 'global', ingested, real: realSummary });
  } catch (error) {
    log('error', 'Synthetic probe cron failed', { error });
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
