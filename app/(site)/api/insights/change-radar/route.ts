import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

const VALID_TYPES = ['pricing', 'quota', 'deprecation', 'migration', 'maintenance'] as const;
const VALID_SEVERITIES = ['info', 'important', 'critical'] as const;

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId') || undefined;
    const data = await insightsService.getChangeRadar({ providerId });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load change radar' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authResponse = requireAdmin(req);
  if (authResponse) return authResponse;

  try {
    const payload = await req.json();
    if (!payload?.providerId || !payload?.type || !payload?.title || !payload?.summary) {
      return NextResponse.json({ error: 'providerId, type, title, summary are required' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(payload.type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    const severity = VALID_SEVERITIES.includes(payload.severity) ? payload.severity : 'info';
    const event = await insightsService.createChangeRadarEvent({
      providerId: payload.providerId,
      type: payload.type,
      title: payload.title,
      summary: payload.summary,
      effectiveDate: payload.effectiveDate || undefined,
      url: payload.url || undefined,
      severity,
    });
    return NextResponse.json(event);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create change radar event' }, { status: 500 });
  }
}
