import { NextRequest } from 'next/server';
import airManifest from '@/public/air.json';
import { jsonResponse } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return jsonResponse(request, airManifest, { cacheSeconds: 300 });
}
