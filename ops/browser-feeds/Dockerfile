# Cloud Run Job that renders Cloudflare-walled status pages (see
# scripts/browser-feeds.mjs). Built from the repo root:
#   gcloud builds submit --config ops/browser-feeds/cloudbuild.yaml .
FROM mcr.microsoft.com/playwright:v1.57.0-jammy
WORKDIR /app
RUN npm install --no-save --no-audit --no-fund playwright@1.57.0
COPY scripts/browser-feeds.mjs scripts/browser-feeds.mjs
COPY lib/data/sources.json lib/data/sources.json
CMD ["node", "scripts/browser-feeds.mjs"]
