import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/firestore';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

function requireCronAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET || process.env.APP_CRON_SECRET;
  const allowOpen = process.env.APP_ALLOW_OPEN_CRON === 'true';
  const isProd = process.env.NODE_ENV === 'production';
  const requireInDev = process.env.APP_REQUIRE_CRON_SECRET === 'true';

  if (!isProd && !requireInDev) return null;
  if (allowOpen) return null;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is required in production (set APP_ALLOW_OPEN_CRON=true to override).' },
      { status: 503 }
    );
  }

  const headerSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');

  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  const provided = bearer || headerSecret;

  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

const STALE_PATTERNS = [
  /human-webhook-/i,
  /example\.com/i,
  /localhost/i,
  /127\.0\.0\.1/i,
  /0\.0\.0\.0/i,
  /::1/i,
];

export async function POST(request: NextRequest) {
  const authResponse = requireCronAuth(request);
  if (authResponse) return authResponse;

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const db = getDb();
  const snapshot = await db.collection('webhooks').get();

  const matches: { id: string; url: string }[] = [];
  let deleted = 0;
  let batch = db.batch();
  let batchCount = 0;
  const batchLimit = 400;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const url = typeof data.url === 'string' ? data.url : '';
    if (!url) continue;

    const isStale = STALE_PATTERNS.some((pattern) => pattern.test(url));
    if (!isStale) continue;

    matches.push({ id: doc.id, url });
    if (!dryRun) {
      batch.delete(doc.ref);
      deleted += 1;
      batchCount += 1;
      if (batchCount >= batchLimit) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  if (matches.length > 0) {
    log('info', 'Pruned stale webhooks', { deleted, matched: matches.length });
  }

  return NextResponse.json({
    dryRun,
    matched: matches.length,
    deleted,
    sample: matches.slice(0, 25),
  });
}
