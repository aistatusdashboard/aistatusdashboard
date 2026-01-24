import { NextResponse } from 'next/server';
import { servePublicFile } from '@/lib/server/serve-public-file';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: { publicPath?: string[] } }
) {
  const parts = params.publicPath || [];
  if (parts.length === 0) {
    return new NextResponse('Not found', { status: 404 });
  }

  const relPath = parts.join('/');
  return servePublicFile(relPath);
}
