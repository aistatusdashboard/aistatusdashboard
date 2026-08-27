import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscriptions';

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
  const { email } = await request.json();
  const siteUrl = getRequestOrigin(request);
  const result = await subscriptionService.resendConfirmation(email, { siteUrl });
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
