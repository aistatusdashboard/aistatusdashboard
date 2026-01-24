import { NextRequest, NextResponse } from 'next/server';
import { commentService } from '@/lib/services/comments';
import { analyticsService } from '@/lib/services/analytics';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');
        const offset = parseInt(searchParams.get('offset') || '0');
        const providerId = searchParams.get('providerId') || undefined;

        const existingSession = request.cookies.get('asd_session')?.value;
        const sessionId = existingSession && existingSession.length >= 16 ? existingSession : undefined;

        const comments = await commentService.getComments({ limit, offset, providerId, sessionId });

        return NextResponse.json({ comments });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { author, content, provider, type } = body;

    // IP detection in Next.js App Router (headers)
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    if (!author || !content) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

        const existingSession = request.cookies.get('asd_session')?.value;
        const sessionId =
            existingSession && existingSession.length >= 16
                ? existingSession
                : crypto.randomBytes(16).toString('hex');

    const result = await commentService.createComment({
      author,
      content,
      provider,
      type,
      ip,
      sessionId,
    });

    if (result) {
            await analyticsService.track('comment_post', provider || undefined, { sessionId });
            const res = NextResponse.json(
                { id: result.id, message: 'Comment submitted for moderation' },
                { status: 201 }
            );
            if (existingSession !== sessionId) {
                res.cookies.set({
                    name: 'asd_session',
                    value: sessionId,
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: request.nextUrl.protocol === 'https:',
                    path: '/',
                    maxAge: 60 * 60 * 24 * 365,
                });
            }
            return res;
    } else {
      return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
