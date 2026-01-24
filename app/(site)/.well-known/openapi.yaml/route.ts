import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/openapi';
import { toYaml } from '@/lib/utils/yaml';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const spec = buildOpenApiSpec('3.1.0');
  const yaml = toYaml(spec);
  const etag = `"${crypto.createHash('sha256').update(yaml).digest('hex')}"`;

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

  return new NextResponse(yaml, {
    headers: {
      ETag: etag,
      'Cache-Control': 'public, max-age=600, s-maxage=1200',
      'Content-Type': 'application/yaml; charset=utf-8',
    },
  });
}
