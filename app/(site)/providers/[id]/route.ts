import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    : `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const fallbackId = request.nextUrl.pathname.split('/').filter(Boolean).pop();
  const providerId = params?.id || fallbackId;
  if (!providerId) {
    return NextResponse.redirect(new URL('/providers', baseUrl), 302);
  }
  const target = new URL(`/provider/${encodeURIComponent(providerId)}`, baseUrl);
  return NextResponse.redirect(target, 301);
}
