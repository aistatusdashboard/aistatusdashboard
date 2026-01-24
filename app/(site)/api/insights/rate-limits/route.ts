import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId') || 'openai';
    const windowMinutes = Number(searchParams.get('windowMinutes') || '30');

    const data = await insightsService.getRateLimits({ providerId, windowMinutes });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load rate limit metrics' }, { status: 500 });
  }
}
