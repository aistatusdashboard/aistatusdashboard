import { NextRequest } from 'next/server';
import { listProviderRegions } from '@/lib/services/public-data';
import { jsonResponse, withResponseMeta } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  const regions = listProviderRegions(params.provider);
  const payload = withResponseMeta(
    {
      provider_id: params.provider,
      regions,
    },
    {
      evidence: [{ ids: [params.provider] }],
      confidence: regions.length ? 0.85 : 0.4,
    }
  );
  return jsonResponse(request, payload, { cacheSeconds: 600 });
}
