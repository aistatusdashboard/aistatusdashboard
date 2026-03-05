import path from 'node:path';
import { promises as fs } from 'node:fs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const airJsonPath = path.join(process.cwd(), 'public', 'air.json');
  const body = await fs.readFile(airJsonPath, 'utf8');

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
