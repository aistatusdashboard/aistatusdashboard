import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId') || 'openai';
    const windowMinutes = Number(searchParams.get('windowMinutes') || '180');
    const at = searchParams.get('at') || undefined;

    const data = await insightsService.getIncidentReplay({ providerId, windowMinutes, at });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load incident replay' }, { status: 500 });
  }
}
