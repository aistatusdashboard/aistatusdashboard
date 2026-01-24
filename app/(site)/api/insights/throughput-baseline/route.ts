import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const model = searchParams.get('model');
    const region = searchParams.get('region');
    if (!providerId || !model || !region) {
      return NextResponse.json({ error: 'providerId, model, and region are required' }, { status: 400 });
    }
    const windowMinutes = Number(searchParams.get('windowMinutes') || '30');
    const baselineWindowMinutes = Number(searchParams.get('baselineWindowMinutes') || `${60 * 24 * 7}`);
    const data = await insightsService.getThroughputBaseline({
      providerId,
      model,
      region,
      windowMinutes,
      baselineWindowMinutes,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load throughput baseline' }, { status: 500 });
  }
}
