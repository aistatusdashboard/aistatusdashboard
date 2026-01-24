import { NextResponse } from 'next/server';
import { intelligenceService } from '@/lib/services/intelligence';

export async function GET() {
  const providers = await intelligenceService.getProviderSummaries();
  return NextResponse.json({ providers });
}
