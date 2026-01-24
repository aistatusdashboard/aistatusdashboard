import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/firestore';
import { EmailUtils } from '@/lib/utils/email';
import { log } from '@/lib/utils/logger';
import { renderEmailTemplate } from '@/lib/utils/email-templates';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic'; // Prevent caching

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
        if (!config.email.enabled) {
            return NextResponse.json(
                {
                    processed: 0,
                    successes: 0,
                    failures: 0,
                    message: 'Email sending is disabled (set APP_ENABLE_EMAIL=true to enable).',
                },
                { status: 503 }
            );
        }

        const db = getDb();
        const queueRef = db.collection('emailQueue');
        const snapshot = await queueRef.where('status', '==', 'pending').limit(50).get(); // Batch size 50

        if (snapshot.empty) {
            return NextResponse.json({
                processed: 0,
                message: 'No pending notifications found in the queue. Trigger a status change first to queue notifications.'
            });
        }

        const results = await Promise.allSettled(snapshot.docs.map(async (doc) => {
            const data = doc.data();
            const attempts = typeof data.attempts === 'number' ? data.attempts : 0;
            const maxAttempts = 3;

            if (!data.to || typeof data.to !== 'string') {
                await doc.ref.update({
                    status: 'failed',
                    attempts: attempts + 1,
                    lastError: 'Missing recipient (to)',
                    updatedAt: new Date(),
                });
                return false;
            }

            let subject: string | undefined = typeof data.subject === 'string' ? data.subject : undefined;
            let html: string | undefined = typeof data.html === 'string' ? data.html : undefined;

            if (!subject || !html) {
                const template = typeof data.template === 'string' ? data.template : undefined;
                const rendered = template ? renderEmailTemplate(template, data.data || {}) : null;
                if (rendered) {
                    subject = rendered.subject;
                    html = rendered.html;
                }
            }

            if (!subject || !html) {
                await doc.ref.update({
                    status: 'failed',
                    attempts: attempts + 1,
                    lastError: 'Missing subject/html and no renderable template',
                    updatedAt: new Date(),
                });
                return false;
            }

            const success = await EmailUtils.sendEmail(data.to, subject, html);

            if (success) {
                await doc.ref.update({
                    status: 'sent',
                    sentAt: new Date(),
                    subject,
                    updatedAt: new Date(),
                });
            } else {
                const nextAttempts = attempts + 1;
                await doc.ref.update({
                    status: nextAttempts >= maxAttempts ? 'failed' : 'pending',
                    attempts: nextAttempts,
                    lastError: 'Send failed',
                    updatedAt: new Date(),
                });
            }
            return success;
        }));

        const processed = results.length;
        const successes = results.filter(r => r.status === 'fulfilled' && r.value).length;

        return NextResponse.json({ processed, successes, failures: processed - successes });
    } catch (error) {
        log('error', 'Cron job failed', { error });
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
