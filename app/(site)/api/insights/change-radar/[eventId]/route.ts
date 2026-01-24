import { NextRequest, NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

function requireAdmin(request: Request): NextResponse | null {
  const secret = process.env.CHANGE_RADAR_SECRET || process.env.APP_CHANGE_RADAR_SECRET;
  const allowOpen = process.env.APP_ALLOW_CHANGE_RADAR === 'true';
  if (allowOpen) return null;
  if (!secret) {
    return NextResponse.json(
      { error: 'CHANGE_RADAR_SECRET is required (set APP_ALLOW_CHANGE_RADAR=true to override).' },
      { status: 503 }
    );
  }

  const headerSecret = request.headers.get('x-admin-secret');
  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  const provided = bearer || headerSecret;

  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function DELETE(request: NextRequest, { params }: { params: { eventId: string } }) {
  const authResponse = requireAdmin(request);
  if (authResponse) return authResponse;

  try {
    await insightsService.deleteChangeRadarEvent(params.eventId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete change radar event' }, { status: 500 });
  }
}
