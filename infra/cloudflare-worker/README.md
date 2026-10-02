# Statuspage proxy (Cloudflare Worker)

Atlassian Statuspage's CDN rate-blocks our App Hosting datacenter egress IP, which
silently takes down every Statuspage-hosted provider feed. This Worker fetches the
statuspage JSON from Cloudflare's network (not blocked) and returns it. The app
(`lib/services/source-ingestion.ts` → `fetchStatuspageResource`) fetches each feed
direct first and only fails over to this Worker when a feed is actually blocked.

- **Live URL:** https://aistatus-proxy.aistatus-khs.workers.dev/?url=<statuspage /api/v2/ json url>
- **Scope:** whitelisted to `https` + path containing `/api/v2/` so it can't be used
  as an open proxy; it only ever returns public status JSON.
- **Cost:** Cloudflare Workers free tier = 100k req/day; we use ~9k/day.
- **App override:** set `STATUSPAGE_PROXY_URL` to point the app at a different worker.

## Deploy / update

Requires Node >= 22 for wrangler, and a Cloudflare API token with "Edit Cloudflare
Workers" permission (env `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`):

    cd infra/cloudflare-worker
    npx wrangler@latest deploy

Or via the REST API (what was used to deploy, works on Node 20):

    curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCT/workers/scripts/aistatus-proxy" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -F 'metadata={"main_module":"worker.js"};type=application/json' \
      -F 'worker.js=@worker.js;type=application/javascript+module'
