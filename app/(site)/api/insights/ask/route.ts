import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const question = payload.question || '';
    const providerId = payload.providerId || 'openai';
    if (!question.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const data = await insightsService.askStatus(question, providerId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to answer question' }, { status: 500 });
  }
}
