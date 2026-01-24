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
  return process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const result = await subscriptionService.confirm(token);
  if (result.success) {
    await analyticsService.track('email_confirm');
  }
  // Redirect to dashboard with status
  const url = new URL('/', getRequestOrigin(request));
  url.searchParams.set('confirmed', result.success.toString());
  return NextResponse.redirect(url);
}
