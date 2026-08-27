# AI Status

**Is ChatGPT down, or is it just you?**

AI Status answers that one question, fast, for the AI apps people actually use:
ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek, Meta AI, GitHub Copilot,
Cursor, Character.AI, and Le Chat.

What makes it different from mirroring an official status page:

- **We test the services ourselves.** Cron-driven probes send real requests to
  each provider every few minutes and record latency and errors
  (`lib/services/provider-probes.ts`).
- **We read the official incident feeds** for every provider and link to the
  original source on each incident (`lib/services/source-ingestion.ts`).
- **Visitors report in.** A one-tap "it's broken for me too" button feeds the
  "is it just you?" verdict, with self-test traffic filtered out.
- **We never fake a green light.** If a status can't be verified it renders as
  "checking", not "operational".

## Stack

Next.js (App Router) · Tailwind CSS · Firebase Firestore · Firebase App Hosting.

## Pages

- `/` — live board for all monitored apps, troubled apps sort first
- `/<app-id>` — per-app verdict page (e.g. `/chatgpt`, `/claude`)
- `/incidents` — outage history with per-incident detail
- `/how-it-works`, `/about`, `/privacy`, `/terms`

## Running locally

```bash
npm install
cp .env.example .env.local   # add Firebase credentials
npm run dev
```

Tests and checks:

```bash
npm run lint
npm run type-check
npm test          # unit tests (jest)
npm run test:e2e  # playwright
```

## Data pipeline

Cron routes under `/api/cron/*` (protected by `CRON_SECRET`) poll status pages,
run live probes, ingest incident feeds, classify community reports, and send
email alerts. Schedules live in Cloud Scheduler; results land in Firestore
(`incidents`, `synthetic_probes`, `casual_reports`, `provider_status`, …).

## License

MIT
