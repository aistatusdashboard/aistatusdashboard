import { NextRequest, NextResponse } from 'next/server';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get('providerId') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;

  const incidents = await intelligenceService.getIncidents({ providerId, startDate, limit });
  return NextResponse.json({ incidents: incidents.map(normalizeIncidentDates) });
}
