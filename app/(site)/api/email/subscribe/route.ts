import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscriptions';
import { analyticsService } from '@/lib/services/analytics';

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
    const { email, providers, sessionId } = await request.json();
    if (!email || !Array.isArray(providers)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const siteUrl = getRequestOrigin(request);
    const result = await subscriptionService.subscribe(email, providers, { siteUrl });
    if (result.success && Array.isArray(providers)) {
      const normalizedSession =
        typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : undefined;
      await Promise.all(
        providers.map((providerId: string) =>
          analyticsService.track('subscription', providerId, {
            source: 'email',
            ...(normalizedSession ? { sessionId: normalizedSession } : {}),
          })
        )
      );
    }
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
