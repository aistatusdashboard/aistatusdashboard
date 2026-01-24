import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { analyticsService } from '@/lib/services/analytics';

function getOrCreateSessionId(request: NextRequest): { sessionId: string; isNew: boolean } {
  const existing = request.cookies.get('asd_session')?.value;
  if (existing && existing.length >= 16) return { sessionId: existing, isNew: false };
  return { sessionId: crypto.randomBytes(16).toString('hex'), isNew: true };
}

function mapComment(docId: string, data: any) {
  const createdAt =
    typeof data.createdAt?.toDate === 'function'
      ? data.createdAt.toDate()
      : typeof data.createdAt === 'string'
        ? new Date(data.createdAt)
        : data.createdAt instanceof Date
          ? data.createdAt
          : new Date();

  return {
    id: docId,
    author: data.author,
    content: data.content,
    provider: data.provider,
    createdAt: createdAt.toISOString(),
    approved: Boolean(data.approved),
    likes: data.likes || 0,
    status: Boolean(data.approved) ? 'approved' : 'pending',
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const { commentId } = await params;
  if (!commentId) return NextResponse.json({ error: 'Missing commentId' }, { status: 400 });

  try {
    const body = await request.json();
    const action = typeof body?.action === 'string' ? body.action : '';

    if (!['like', 'report'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { sessionId, isNew } = getOrCreateSessionId(request);
    const db = getDb();

    const commentRef = db.collection('comments').doc(commentId);

    if (action === 'like') {
      const likeRef = commentRef.collection('likes').doc(sessionId);

      await db.runTransaction(async (tx) => {
        const [commentSnap, likeSnap] = await Promise.all([
          tx.get(commentRef),
          tx.get(likeRef),
        ]);

        if (!commentSnap.exists) {
          throw new Error('NOT_FOUND');
        }

        if (likeSnap.exists) {
          return;
        }

        tx.set(likeRef, { createdAt: new Date() });
        tx.update(commentRef, { likes: FieldValue.increment(1) });
      });
    }

    if (action === 'report') {
      const reportRef = commentRef.collection('reports').doc(sessionId);

      await db.runTransaction(async (tx) => {
        const [commentSnap, reportSnap] = await Promise.all([
          tx.get(commentRef),
          tx.get(reportRef),
        ]);

        if (!commentSnap.exists) {
          throw new Error('NOT_FOUND');
        }

        if (reportSnap.exists) {
          return;
        }

        tx.set(reportRef, { createdAt: new Date() });
        tx.update(commentRef, {
          reported: true,
          reports: FieldValue.increment(1),
        });
      });
    }

    const updated = await commentRef.get();
    if (!updated.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updatedData = updated.data();
    await analyticsService.track(
      action === 'like' ? 'comment_like' : 'comment_report',
      updatedData?.provider || undefined,
      { sessionId }
    );

    const res = NextResponse.json({ comment: mapComment(updated.id, updatedData) });
    if (isNew) {
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
  } catch (error: any) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
