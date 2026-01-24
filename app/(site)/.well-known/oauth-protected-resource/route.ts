import { NextRequest } from 'next/server';
import { getRequestOrigin } from '@/lib/utils/request';
import { jsonResponse } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const payload = {
    resource: origin,
    authorization_servers: [`${origin}`],
    scopes_supported: ['org.read'],
    bearer_methods_supported: ['authorization_header'],
    resource_documentation: `${origin}/docs/agent/mcp-quickstart`,
  };
  return jsonResponse(request, payload, { cacheSeconds: 300 });
}
