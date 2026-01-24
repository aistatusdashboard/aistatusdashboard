import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId') || 'openai';
    const windowMinutes = Number(searchParams.get('windowMinutes') || '30');
    const data = await insightsService.getBehavioral({ providerId, windowMinutes });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load behavioral metrics' }, { status: 500 });
  }
}
