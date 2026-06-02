import { NextRequest, NextResponse } from 'next/server';
import { classifyRecentCasualReports } from '@/lib/services/casual-report-maintenance';

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

export async function POST(request: NextRequest) {
  const authResponse = requireCronAuth(request);
  if (authResponse) return authResponse;

  const payload = await request.json().catch(() => ({}));
  const summary = await classifyRecentCasualReports({
    days: payload?.days,
    knownSelfTestIpPrefixes: Array.isArray(payload?.knownSelfTestIpPrefixes) ? payload.knownSelfTestIpPrefixes : [],
    knownSelfTestFingerprints: Array.isArray(payload?.knownSelfTestFingerprints)
      ? payload.knownSelfTestFingerprints
      : [],
    knownBotUserAgents: Array.isArray(payload?.knownBotUserAgents) ? payload.knownBotUserAgents : [],
  });

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary,
  });
}
