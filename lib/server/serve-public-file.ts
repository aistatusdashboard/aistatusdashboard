import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

type ServeOptions = {
  contentType?: string;
  cacheControl?: string;
};

const CONTENT_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.ndjson': 'application/x-ndjson; charset=utf-8',
};

function cacheControlFor(relPath: string, ext: string): string {
  if (relPath === 'rss.xml') return 'public, max-age=60, s-maxage=300';
  if (relPath === 'sitemap.xml') return 'public, max-age=300, s-maxage=600';
  if (relPath === 'robots.txt') return 'public, max-age=300, s-maxage=600';
  if (relPath.endsWith('.md')) return 'public, max-age=300, s-maxage=600';
  if (relPath.endsWith('.csv') || relPath.endsWith('.ndjson')) {
    return 'public, max-age=60, s-maxage=300';
  }
  if (relPath.endsWith('.json') || relPath.endsWith('.yaml') || relPath.endsWith('.yml')) {
    return 'public, max-age=600, s-maxage=1200';
  }
  if (ext === '.svg' || ext === '.png' || ext === '.ico') {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=300, s-maxage=600';
}

export async function servePublicFile(relPath: string, options: ServeOptions = {}) {
  const publicRoot = path.join(process.cwd(), 'public');
  const targetPath = path.join(publicRoot, relPath);
  const normalized = path.normalize(targetPath);

  if (!normalized.startsWith(publicRoot + path.sep)) {
    return new NextResponse('Not found', { status: 404 });
  }

  let data: Buffer;
  try {
    data = await fs.readFile(normalized);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = path.extname(normalized);
  const contentType = options.contentType || CONTENT_TYPES[ext] || 'application/octet-stream';
  const cacheControl = options.cacheControl || cacheControlFor(relPath, ext);

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'X-Static-Handler': 'public-fallback',
    },
  });
}
