import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analytics';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const windowDaysRaw = parseInt(searchParams.get('windowDays') || '7', 10);
    const windowDays = Number.isFinite(windowDaysRaw) && windowDaysRaw > 0 ? windowDaysRaw : 7;

    const data = await analyticsService.getOverview(windowDays);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
