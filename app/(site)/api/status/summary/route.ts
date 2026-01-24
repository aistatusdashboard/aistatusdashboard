import { NextRequest, NextResponse } from 'next/server';
import { persistenceService } from '@/lib/services/persistence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const result = await persistenceService.getSummary({
      providerId: searchParams.get('provider') || undefined,
      days: parseInt(searchParams.get('days') || '7')
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}