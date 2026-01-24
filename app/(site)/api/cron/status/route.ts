import { NextRequest, NextResponse } from 'next/server';
import { statusOrchestrator } from '@/lib/services/orchestrator';
import { log } from '@/lib/utils/logger';

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
        const stats = await statusOrchestrator.runCycle();
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...stats,
            message: `Status check complete. Checked ${stats.providersChecked} providers, detected ${stats.changesDetected} changes.`
        });
    } catch (error) {
        log('error', 'Cron status failed', { error });
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
