import { NextRequest } from 'next/server';
import { jsonResponse, buildResponseMeta } from '@/lib/utils/public-api';
import { submitCasualReport } from '@/lib/services/casual';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  if (!payload || !payload.app || !payload.surface || typeof payload.issue !== 'boolean') {
    const meta = buildResponseMeta({ evidence: [], confidence: 0 });
    return jsonResponse(
      request,
      {
        ...meta,
        data: { error: 'app, surface, issue are required' },
      },
      { cacheSeconds: 0, status: 400 }
    );
  }

  const result = await submitCasualReport({
    appId: String(payload.app),
    surface: payload.surface,
    issue: Boolean(payload.issue),
    issueType: payload.issueType ? String(payload.issueType) : undefined,
    region: payload.region ? String(payload.region) : undefined,
    clientType: payload.clientType ? String(payload.clientType) : undefined,
    headers: request.headers,
  });

  const meta = buildResponseMeta({ evidence: [], confidence: result.ok ? 0.6 : 0.2 });
  return jsonResponse(
    request,
    {
      ...meta,
      data: { ok: result.ok, message: result.message || null },
    },
    { cacheSeconds: 0, status: result.status }
  );
}
