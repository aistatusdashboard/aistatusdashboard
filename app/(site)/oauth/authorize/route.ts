import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { error: 'oauth_not_configured', message: 'OAuth authorization endpoint is not configured.' },
    { status: 501 }
  );
}
