// Proxy for Atlassian Statuspage JSON that App Hosting's datacenter IP is
// blocked from reading. Runs on Cloudflare's network (not blocked by Atlassian).
// Whitelisted to https statuspage /api/v2/ endpoints, and gated by a shared
// secret (env PROXY_KEY) so it can't be used by anyone but our ingest.
export default {
  async fetch(request, env) {
    if (env.PROXY_KEY && request.headers.get('x-proxy-key') !== env.PROXY_KEY) {
      return json({ error: 'unauthorized' }, 401);
    }
    const u = new URL(request.url);
    const target = u.searchParams.get('url');
    if (!target) return json({ error: 'missing url' }, 400);
    let t;
    try { t = new URL(target); } catch { return json({ error: 'bad url' }, 400); }
    if (t.protocol !== 'https:' || !t.pathname.includes('/api/v2/')) return json({ error: 'forbidden' }, 403);
    let upstream;
    try {
      upstream = await fetch(t.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cf: { cacheTtl: 30, cacheEverything: true },
      });
    } catch (e) { return json({ error: 'upstream fetch failed', detail: String(e) }, 502); }
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'public, max-age=30',
      },
    });
  },
};
function json(o, status) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
}
