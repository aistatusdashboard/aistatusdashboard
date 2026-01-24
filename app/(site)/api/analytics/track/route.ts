import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analytics';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, action, providerId, provider, sessionId, timestamp, metadata } = body || {};

    const normalizedEvent =
      typeof event === 'string' && event.length > 0
        ? event
        : typeof action === 'string' && action.length > 0
          ? action
          : 'interaction';

    const normalizedProviderId =
      typeof providerId === 'string' && providerId.length > 0
        ? providerId
        : typeof provider === 'string' && provider.length > 0
          ? provider
          : undefined;

    await analyticsService.track(normalizedEvent, normalizedProviderId, {
      ...(metadata || {}),
      ...(sessionId ? { sessionId } : {}),
      ...(timestamp ? { timestamp } : {}),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
