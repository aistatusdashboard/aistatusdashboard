import { NextRequest } from 'next/server';
import { getStatusSummary } from '@/lib/services/public-data';
import { jsonResponse, buildResponseMeta } from '@/lib/utils/public-api';
import { requireOrgScope } from '@/lib/utils/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lens = searchParams.get('lens') || undefined;
  if (lens === 'my_org') {
    const auth = requireOrgScope(request);
    if (!auth.ok) {
      const meta = buildResponseMeta({ evidence: [], confidence: 0 });
      return jsonResponse(
        request,
        {
          ...meta,
          data: {
            error: 'unauthorized',
            message: 'OAuth scope org.read is required for lens=my_org.',
          },
        },
        { cacheSeconds: 0, status: 401 }
      );
    }
  }

  const payload = await getStatusSummary({
    providerId: searchParams.get('provider') || undefined,
    windowSeconds: searchParams.get('window_seconds')
      ? Number(searchParams.get('window_seconds'))
      : undefined,
    lens,
  });

  const meta = buildResponseMeta({ evidence: payload.evidence, confidence: payload.confidence });
  return jsonResponse(
    request,
    {
      ...meta,
      data: payload.data,
    },
    { cacheSeconds: 60 }
  );
}
