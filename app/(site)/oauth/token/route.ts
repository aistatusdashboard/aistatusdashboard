import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    { error: 'oauth_not_configured', message: 'OAuth token endpoint is not configured.' },
    { status: 501 }
  );
}
