import { NextResponse } from 'next/server';
import { servePublicFile } from '@/lib/server/serve-public-file';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { path?: string[] } }
) {
  const parts = params.path || [];
  if (parts.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const relPath = `brand/${parts.join('/')}`;
  return servePublicFile(relPath);
}
