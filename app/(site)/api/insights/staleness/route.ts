import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const windowParam = searchParams.get('windowMinutes');
    const windowMinutes = windowParam ? Number(windowParam) : undefined;
    const signals = await insightsService.getStalenessSignals({
      windowMinutes: Number.isFinite(windowMinutes as number) ? (windowMinutes as number) : undefined,
    });
    return NextResponse.json({ signals });
  } catch {
    return NextResponse.json({ error: 'Failed to compute staleness signals' }, { status: 500 });
  }
}
