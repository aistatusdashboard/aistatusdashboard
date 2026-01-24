import { NextRequest } from 'next/server';
import { jsonResponse, buildResponseMeta } from '@/lib/utils/public-api';
import { getCasualStatus } from '@/lib/services/casual';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const app = searchParams.get('app');
  const windowMinutes = searchParams.get('window_minutes')
    ? Number(searchParams.get('window_minutes'))
    : undefined;

  if (!app) {
    const meta = buildResponseMeta({ evidence: [], confidence: 0 });
    return jsonResponse(
      request,
      {
        ...meta,
        data: { error: 'app is required' },
      },
      { cacheSeconds: 0, status: 400 }
    );
  }

  const payload = await getCasualStatus({ appId: app, windowMinutes });
  if (!payload) {
    const meta = buildResponseMeta({ evidence: [], confidence: 0 });
    return jsonResponse(
      request,
      {
        ...meta,
        data: { error: 'unknown app' },
      },
      { cacheSeconds: 0, status: 404 }
    );
  }

  const meta = buildResponseMeta({ evidence: [], confidence: payload.confidence });
  return jsonResponse(
    request,
    {
      ...meta,
      data: payload,
    },
    { cacheSeconds: 60 }
  );
}
