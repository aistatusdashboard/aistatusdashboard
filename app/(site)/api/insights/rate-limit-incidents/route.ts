import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const windowMinutes = Number(searchParams.get('windowMinutes') || '30');
    const incidents = await insightsService.getRateLimitIncidents({ windowMinutes });
    return NextResponse.json({ incidents });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load rate-limit incidents' }, { status: 500 });
  }
}
