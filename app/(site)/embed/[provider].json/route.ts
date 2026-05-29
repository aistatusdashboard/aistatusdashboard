import { NextRequest, NextResponse } from 'next/server';
import { getEmbedStatus } from '@/lib/services/embed';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { provider: string } | Promise<{ provider: string }> }
) {
  const resolved = await Promise.resolve(params as { provider: string });
  const payload = await getEmbedStatus(resolved.provider);
  if (!payload) {
    return NextResponse.json({ error: 'provider not found' }, { status: 404 });
  }
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=120',
    },
  });
}
