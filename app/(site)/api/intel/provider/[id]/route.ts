import { NextRequest, NextResponse } from 'next/server';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates, normalizeMaintenanceDates } from '@/lib/utils/normalize-dates';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
  }
  const detail = await intelligenceService.getProviderDetail(id);
  return NextResponse.json({
    ...detail,
    incidents: detail.incidents.map(normalizeIncidentDates),
    maintenances: detail.maintenances.map(normalizeMaintenanceDates),
  });
}
