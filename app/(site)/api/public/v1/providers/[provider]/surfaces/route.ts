import { NextRequest } from 'next/server';
import { listProviderSurfaces } from '@/lib/services/public-data';
import { jsonResponse, withResponseMeta } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  const surfaces = listProviderSurfaces(params.provider);
  const payload = withResponseMeta(
    {
      provider_id: params.provider,
      surfaces,
    },
    {
      evidence: [{ ids: [params.provider] }],
      confidence: surfaces.length ? 0.85 : 0.4,
    }
  );
  return jsonResponse(request, payload, { cacheSeconds: 600 });
}
