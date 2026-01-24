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
  const { email, sessionId } = await request.json();
  const siteUrl = getRequestOrigin(request);
  const result = await subscriptionService.resendConfirmation(email, { siteUrl });
  if (result.success) {
    const normalizedSession =
      typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : undefined;
    await analyticsService.track('email_resend', undefined, {
      ...(normalizedSession ? { sessionId: normalizedSession } : {}),
    });
  }
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
