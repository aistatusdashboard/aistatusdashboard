import { NextRequest, NextResponse } from 'next/server';
import { persistenceService } from '@/lib/services/persistence';

export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const { provider } = await params;

    const result = await persistenceService.getHistory({
      providerId: provider,
      limit: parseInt(searchParams.get('limit') || '50'),
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
