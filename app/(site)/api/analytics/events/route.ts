import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analytics';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const options: any = {};

    if (searchParams.has('provider')) options.provider = searchParams.get('provider');
    if (searchParams.has('limit')) options.limit = parseInt(searchParams.get('limit') || '100');

    const events = await analyticsService.getEvents(options);
    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}