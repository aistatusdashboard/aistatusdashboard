import { NextRequest, NextResponse } from 'next/server';
import { subscriptionService } from '@/lib/services/subscriptions';
import { verifyUnsubscribe } from '@/lib/utils/unsubscribe-token';

// Every alert email links here with a signed token. GET is the human click;
// POST is the mail client's one-click unsubscribe (RFC 8058), which sends
// `List-Unsubscribe=One-Click` to the same URL.

function credentials(req: NextRequest): { email: string; token: string } {
    const email = req.nextUrl.searchParams.get('email') || '';
    const token = req.nextUrl.searchParams.get('token') || '';
    return { email: email.trim().toLowerCase(), token };
}

function siteOrigin(req: NextRequest): string {
    const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    return host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
}

export async function GET(req: NextRequest) {
    const { email, token } = credentials(req);
    if (!verifyUnsubscribe(email, token)) {
        return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 });
    }
    await subscriptionService.unsubscribe(email);
    const url = new URL('/', siteOrigin(req));
    url.searchParams.set('unsubscribed', 'true');
    return NextResponse.redirect(url);
}

export async function POST(req: NextRequest) {
    const { email, token } = credentials(req);
    if (!verifyUnsubscribe(email, token)) {
        return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 });
    }
    await subscriptionService.unsubscribe(email);
    return NextResponse.json({ message: 'Unsubscribed' });
}
