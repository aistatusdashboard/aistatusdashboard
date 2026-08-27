import { log } from '@/lib/utils/logger';

// IndexNow gets new outage pages into Bing/DuckDuckGo within hours instead of
// weeks — that's where a young domain can actually rank during an incident.
const INDEXNOW_KEY = '5142c04c98fd0a6b3208e2a7f790351e';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';

export async function pingIndexNow(paths: string[]): Promise<void> {
  if (!paths.length) return;
  if (process.env.NODE_ENV !== 'production') return;
  try {
    const host = new URL(SITE_URL).host;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: paths.slice(0, 100).map((p) => `${SITE_URL}${p}`),
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    log('info', 'IndexNow pinged', { count: paths.length });
  } catch (error) {
    // Search-engine pings are best-effort only.
    log('warn', 'IndexNow ping failed', { error });
  }
}
