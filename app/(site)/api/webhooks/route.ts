import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/firestore';
import { log } from '@/lib/utils/logger';
import { analyticsService } from '@/lib/services/analytics';

function requireWebhookAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.WEBHOOK_SECRET || process.env.APP_WEBHOOK_SECRET;
  const allowPublic = process.env.APP_ALLOW_PUBLIC_WEBHOOKS === 'true';
  const isProd = process.env.NODE_ENV === 'production';
  const requireInDev = process.env.APP_REQUIRE_WEBHOOK_SECRET === 'true';

  if (!isProd && !requireInDev) return null;
  if (allowPublic) return null;
  if (!secret) {
    return NextResponse.json(
      { error: 'WEBHOOK_SECRET is required in production (set APP_ALLOW_PUBLIC_WEBHOOKS=true to override).' },
      { status: 503 }
    );
  }

  const headerSecret = request.headers.get('x-webhook-secret');
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  const provided = bearer || headerSecret;

  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
  return false;
}

function isBlockedHostname(hostname: string, options: { allowLocal: boolean }): boolean {
  const host = hostname.toLowerCase();
  if (options.allowLocal && isLoopbackHostname(host)) return false;

  if (host === 'metadata.google.internal' || host === '169.254.169.254' || host === '169.254.170.2') return true;

  // Block private IPv4 ranges (best-effort; DNS names can still resolve privately)
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;

  return false;
}

function validateWebhookUrl(rawUrl: unknown): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return { ok: false, error: 'URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URL must not include credentials' };
  }

  const allowLocal = process.env.ALLOW_LOCAL_WEBHOOKS === 'true';

  if (parsed.protocol !== 'https:') {
    const isLocalHttpOk =
      allowLocal && parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname);
    if (!isLocalHttpOk) {
      return { ok: false, error: 'Only https:// webhooks are allowed' };
    }
  }

  if (isBlockedHostname(parsed.hostname, { allowLocal })) {
    return { ok: false, error: 'Blocked webhook host' };
  }

  // Normalize: URL.toString() adds a trailing "/" for bare hostnames (https://example.com -> https://example.com/).
  // Store the origin-only form for root-path URLs so equality checks remain intuitive.
  const normalized =
    parsed.pathname === '/' && parsed.search === '' && parsed.hash === '' ? parsed.origin : parsed.toString();

  return { ok: true, url: normalized };
}

export async function POST(request: NextRequest) {
  try {
    const authResponse = requireWebhookAuth(request);
    if (authResponse) return authResponse;

    const { url, providers, sessionId } = await request.json();

    const validated = validateWebhookUrl(url);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

    const db = getDb();
    await db.collection('webhooks').add({
      url: validated.url,
      providers: Array.isArray(providers) ? providers : [],
      active: true,
      failureCount: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      lastFailureStatus: null,
      lastSuccessAt: null,
      disabledAt: null,
      disabledReason: null,
      createdAt: new Date(),
    });

    const normalizedSession =
      typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : undefined;
    const providerList = Array.isArray(providers) && providers.length > 0 ? providers : [undefined];
    await Promise.all(
      providerList.map((providerId) =>
        analyticsService.track('webhook_register', providerId, {
          ...(normalizedSession ? { sessionId: normalizedSession } : {}),
        })
      )
    );

    return NextResponse.json({ message: 'Webhook registered successfully' });
  } catch (error: any) {
    log('error', 'Webhook registration failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to register webhook' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ webhooks: [] });
}
