import crypto from 'node:crypto';
import { log } from '@/lib/utils/logger';

// Server-side conversion events via the GA4 Measurement Protocol.
//
// The browser also fires funnel events, but GA4 discards events from visitors
// who never accepted the cookie banner — which is most people who sign up
// during an outage. The database saw 5 sign-ups where GA saw 0. These two
// events are sent from the server at the moment the row is written, carry no
// personal data, and use a random client id, so GA's funnel finally matches
// the database.

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-ZV3PS0MPQ7';

export async function sendServerEvent(
    name: 'subscription_created' | 'subscription_confirmed',
    params: Record<string, string | number | boolean> = {}
): Promise<void> {
    const apiSecret = process.env.GA_MP_API_SECRET;
    if (!apiSecret) return;
    try {
        const response = await fetch(
            `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${apiSecret}`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    client_id: `srv.${crypto.randomUUID()}`,
                    non_personalized_ads: true,
                    events: [{ name, params: { ...params, engagement_time_msec: 1 } }],
                }),
                signal: AbortSignal.timeout(4000),
            }
        );
        if (!response.ok) log('warn', 'GA server event rejected', { name, status: response.status });
    } catch (error) {
        log('warn', 'GA server event failed', { name, error });
    }
}
