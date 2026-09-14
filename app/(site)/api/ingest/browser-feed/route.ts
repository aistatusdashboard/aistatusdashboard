import { NextRequest, NextResponse } from 'next/server';
import { isBrowserFeedSnapshot, writeFeedSnapshot } from '@/lib/services/feed-snapshots';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// Receives what the browser feed job (.github/workflows/browser-feeds.yml)
// read off a status page we cannot fetch directly. Same secret as the crons.
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.APP_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : request.headers.get('x-cron-secret');
  return bearer === secret;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const snapshots = Array.isArray(body) ? body : [body];
  const accepted: string[] = [];
  for (const snapshot of snapshots) {
    if (!isBrowserFeedSnapshot(snapshot)) continue;
    if (snapshot.components.length > 500 || snapshot.incidents.length > 500) continue;
    await writeFeedSnapshot(snapshot);
    accepted.push(snapshot.sourceId);
  }
  if (!accepted.length) {
    return NextResponse.json({ error: 'No valid snapshots' }, { status: 400 });
  }
  log('info', 'Browser feed snapshots stored', { sources: accepted });
  return NextResponse.json({ ok: true, accepted });
}
