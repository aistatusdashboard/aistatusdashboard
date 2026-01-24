import { NextRequest } from 'next/server';
import { buildMcpDiscovery } from '@/lib/mcp/server';
import { getRequestOrigin } from '@/lib/utils/request';
import { jsonResponse } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const payload = buildMcpDiscovery(origin);
  return jsonResponse(request, payload, { cacheSeconds: 300 });
}
