import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId') || 'openai';
    const windowMinutes = Number(searchParams.get('windowMinutes') || '60');

    const data = await insightsService.getForecast({ providerId, windowMinutes });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load forecast' }, { status: 500 });
  }
}
