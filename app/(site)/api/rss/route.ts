import { NextRequest, NextResponse } from 'next/server';
import { generateRSSFeed } from '@/lib/utils/rss';

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || request.headers.get('host');
  const proto = forwardedProto?.split(',')[0]?.trim();

  if (proto && host) return `${proto}://${host}`;
  if (host) return `${request.nextUrl.protocol}//${host}`;
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const options: any = {};
    if (searchParams.has('limit')) options.limit = parseInt(searchParams.get('limit') || '50');
    if (searchParams.has('provider')) options.provider = searchParams.get('provider');

    const siteUrl = getRequestOrigin(request);
    const rssContent = await generateRSSFeed({ ...options, siteUrl });

    return new NextResponse(rssContent, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    });
  } catch (error) {
    return new NextResponse('RSS generation failed', { status: 500 });
  }
}
