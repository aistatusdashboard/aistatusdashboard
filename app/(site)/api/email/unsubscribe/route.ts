import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscriptions';
import { analyticsService } from '@/lib/services/analytics';

export async function POST(req: NextRequest) {
    try {
        const { email, sessionId } = await req.json();
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }
        await subscriptionService.unsubscribe(email);
        const normalizedSession =
            typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : undefined;
        await analyticsService.track('email_unsubscribe', undefined, {
            ...(normalizedSession ? { sessionId: normalizedSession } : {}),
        });
        return NextResponse.json({ message: 'Unsubscribed successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
