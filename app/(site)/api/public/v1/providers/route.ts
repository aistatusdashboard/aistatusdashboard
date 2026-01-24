import { NextRequest } from 'next/server';
import { listProviders } from '@/lib/services/public-data';
import { jsonResponse, withResponseMeta } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const providers = listProviders();
  const payload = withResponseMeta(providers, {
    evidence: [{ ids: providers.map((p) => p.id) }],
    confidence: 0.9,
  });
  return jsonResponse(request, payload, { cacheSeconds: 300 });
}
