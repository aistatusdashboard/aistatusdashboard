import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';
import { getProbeDefaults } from '@/lib/utils/probe-defaults';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId') || 'openai';
    const defaults = getProbeDefaults(providerId);
    const model = searchParams.get('model') || defaults?.model || 'core';
    const endpoint = searchParams.get('endpoint') || defaults?.endpoint || 'api';
    const region = searchParams.get('region') || defaults?.region || 'global';
    const tier = searchParams.get('tier') || defaults?.tier || 'unknown';
    const streaming =
      searchParams.has('streaming') ? searchParams.get('streaming') === 'true' : Boolean(defaults?.streaming);
    const windowMinutes = Number(searchParams.get('windowMinutes') || '30');
    const accountId = searchParams.get('accountId') || undefined;

    const data = await insightsService.getCanaryCopilot({
      providerId,
      model,
      endpoint,
      region,
      tier,
      streaming,
      windowMinutes,
      accountId,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load canary data' }, { status: 500 });
  }
}
