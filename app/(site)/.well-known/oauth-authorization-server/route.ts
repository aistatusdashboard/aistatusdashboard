import { NextRequest } from 'next/server';
import { getRequestOrigin } from '@/lib/utils/request';
import { jsonResponse } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const payload = {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    scopes_supported: ['org.read'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
  };
  return jsonResponse(request, payload, { cacheSeconds: 300 });
}
