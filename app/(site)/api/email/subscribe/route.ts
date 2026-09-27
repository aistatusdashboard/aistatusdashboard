import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscriptions';

// Lightweight per-IP throttle so the signup form can't be used to email-bomb
// addresses or burn the daily send quota. In-memory per instance — enough to
// stop the obvious abuse; the confirmation double-opt-in is the real backstop.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) { for (const k of hits.keys()) { if ((hits.get(k) || []).every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k); } }
  return recent.length > RATE_MAX;
}
function clientIp(request: NextRequest): string {
  return (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim())
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || request.headers.get('host');
  const proto = forwardedProto?.split(',')[0]?.trim();

  if (proto && host) return `${proto}://${host}`;
  if (host) return `${request.nextUrl.protocol}//${host}`;
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  try {
    if (rateLimited(clientIp(request))) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }
    const { email, providers } = await request.json();
    if (!email || typeof email !== 'string' || !Array.isArray(providers)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    // Require a real email shape so malformed addresses ("notanemail") don't
    // create junk pending subscriptions and bounce confirmation mail.
    const trimmed = email.trim();
    if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const siteUrl = getRequestOrigin(request);
    const result = await subscriptionService.subscribe(trimmed, providers, { siteUrl });
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
