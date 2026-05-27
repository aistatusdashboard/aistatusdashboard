import crypto from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const body = await readFile(path.join(process.cwd(), 'public', 'openapi.json'), 'utf8');
  const etag = `"${crypto.createHash('sha256').update(body).digest('hex')}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=600, s-maxage=1200',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
  return new NextResponse(body, {
    headers: {
      ETag: etag,
      'Cache-Control': 'public, max-age=600, s-maxage=1200',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
