import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analytics';

export async function GET(request: NextRequest) {
    try {
        const data = await analyticsService.getCostMetrics();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
