import crypto from 'node:crypto';

// One-click unsubscribe links carry a signature so nobody can unsubscribe
// someone else by guessing an address. Mail clients hit the same URL via
// List-Unsubscribe / List-Unsubscribe-Post (RFC 8058).

function secret(): string {
    return (
        process.env.UNSUBSCRIBE_SECRET ||
        process.env.CRON_SECRET ||
        process.env.APP_CRON_SECRET ||
        'dev-only-unsubscribe-secret'
    );
}

export function signUnsubscribe(email: string): string {
    return crypto.createHmac('sha256', secret()).update(email.trim().toLowerCase()).digest('hex').slice(0, 40);
}

export function verifyUnsubscribe(email: string, token: string): boolean {
    if (!email || !token) return false;
    const expected = signUnsubscribe(email);
    if (expected.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function buildUnsubscribeUrl(siteUrl: string, email: string): string {
    const base = siteUrl.replace(/\/$/, '');
    return `${base}/api/email/unsubscribe?email=${encodeURIComponent(email)}&token=${signUnsubscribe(email)}`;
}
