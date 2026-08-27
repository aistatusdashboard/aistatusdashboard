import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscriptions';

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }
        await subscriptionService.unsubscribe(email);
        return NextResponse.json({ message: 'Unsubscribed successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
