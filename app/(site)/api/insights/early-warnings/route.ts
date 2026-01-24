import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const windowMinutes = Number(searchParams.get('windowMinutes') || '30');
    const warnings = await insightsService.getEarlyWarnings({ windowMinutes });
    return NextResponse.json({ warnings });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load early warnings' }, { status: 500 });
  }
}
