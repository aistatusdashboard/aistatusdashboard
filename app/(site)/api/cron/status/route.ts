import { NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/utils/logger';
import { drainEmailQueue } from '@/lib/services/email-queue';

export const dynamic = 'force-dynamic';

function requireCronAuth(request: NextRequest): NextResponse | null {
    const secret = process.env.CRON_SECRET || process.env.APP_CRON_SECRET;
    const allowOpen = process.env.APP_ALLOW_OPEN_CRON === 'true';
    const isProd = process.env.NODE_ENV === 'production';
    const requireInDev = process.env.APP_REQUIRE_CRON_SECRET === 'true';

    if (!isProd && !requireInDev) return null;
    if (allowOpen) return null;
    if (!secret) {
        return NextResponse.json(
            { error: 'CRON_SECRET is required in production (set APP_ALLOW_OPEN_CRON=true to override).' },
            { status: 503 }
        );
    }

    const headerSecret = request.headers.get('x-cron-secret');
    const authHeader = request.headers.get('authorization');

    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    const provided = bearer || headerSecret;

    if (provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return null;
}

export async function GET(request: NextRequest) {
    const authResponse = requireCronAuth(request);
    if (authResponse) return authResponse;

    try {
        // This endpoint used to run a second, older status check of 28 providers
        // that wrote the 5-minute status log and decided the email alerts. It
        // disagreed with the pages, missed the 11 newer apps and went blind on
        // Mistral; alerts now run at the end of the ingest cycle over the same
        // reading the pages show (lib/services/alert-cycle.ts), and nothing reads
        // the log. The route stays so the existing scheduler job keeps working;
        // all it does is flush any queued email.
        const emails = await drainEmailQueue().catch((error) => {
            log('error', 'Email queue drain failed', { error });
            return null;
        });
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            emails,
            message: 'Status checks and alerts run in /api/cron/ingest; this endpoint only drains the email queue.',
        });
    } catch (error) {
        log('error', 'Cron status failed', { error });
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
