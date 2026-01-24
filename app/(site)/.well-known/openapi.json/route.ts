import { NextRequest } from 'next/server';
import { buildOpenApiSpec } from '@/lib/openapi';
import { jsonResponse } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const payload = buildOpenApiSpec('3.1.0');
  return jsonResponse(request, payload, { cacheSeconds: 600 });
}
