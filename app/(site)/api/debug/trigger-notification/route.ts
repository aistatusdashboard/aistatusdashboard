import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/services/notifications';
import { providerService } from '@/lib/services/providers';
import type { ProviderStatus, StatusResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

function getDebugSecret(): string | null {
  return process.env.DEBUG_SECRET || process.env.APP_DEBUG_SECRET || null;
}

function isEnabled(): boolean {
  return process.env.APP_ENABLE_DEBUG_ENDPOINTS === 'true';
}

function requireDebugAuth(request: NextRequest): NextResponse | null {
  if (!isEnabled()) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

  const secret = getDebugSecret();
  if (!secret) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

  const provided = request.headers.get('x-debug-secret') || request.headers.get('authorization');
  const bearer =
    provided && provided.startsWith('Bearer ') ? provided.slice('Bearer '.length) : provided;

  if (bearer !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function isProviderStatus(value: unknown): value is ProviderStatus {
  return value === 'operational' || value === 'degraded' || value === 'down' || value === 'unknown';
}

export async function POST(request: NextRequest) {
  const auth = requireDebugAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json();
    const providerId = typeof body?.providerId === 'string' ? body.providerId : null;
    const currentStatus = body?.currentStatus;
    const previousStatus = body?.previousStatus;

    if (!providerId || !isProviderStatus(currentStatus) || !isProviderStatus(previousStatus)) {
      return NextResponse.json(
        { error: 'Invalid payload', expected: { providerId: 'string', currentStatus: 'ProviderStatus', previousStatus: 'ProviderStatus' } },
        { status: 400 }
      );
    }

    const provider = providerService.getProvider(providerId);
    const now = new Date().toISOString();

    const base: Omit<StatusResult, 'status'> = {
      id: providerId,
      name: provider?.name || providerId,
      responseTime: 0,
      lastChecked: now,
      statusPageUrl: provider?.statusPageUrl || '',
    };

    await notificationService.notifyStatusChange(
      { ...base, status: currentStatus },
      { ...base, status: previousStatus }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

