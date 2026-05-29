import crypto from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function buildEtag(body: string) {
  return `"${crypto.createHash('sha256').update(body).digest('hex')}"`;
}

export async function GET(request: NextRequest) {
  const filePath = path.join(process.cwd(), 'public', 'openapi.yaml');
  const body = await readFile(filePath, 'utf8');
  const etag = buildEtag(body);

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=600, s-maxage=1200',
        'Content-Type': 'application/yaml; charset=utf-8',
      },
    });
  }

  return new NextResponse(body, {
    headers: {
      ETag: etag,
      'Cache-Control': 'public, max-age=600, s-maxage=1200',
      'Content-Type': 'application/yaml; charset=utf-8',
    },
  });
}
