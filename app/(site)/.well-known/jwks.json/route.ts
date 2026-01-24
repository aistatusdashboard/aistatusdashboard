import { NextRequest } from 'next/server';
import { jsonResponse } from '@/lib/utils/public-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return jsonResponse(request, { keys: [] }, { cacheSeconds: 300 });
}
