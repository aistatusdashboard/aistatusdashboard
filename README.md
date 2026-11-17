# AI Status

**Is ChatGPT down, or is it just you?**

AI Status answers that one question, fast, for 42 AI apps people actually use:
ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek, GitHub Copilot, Cursor,
and more (the full list is `lib/casual/apps.json`).

How it works:

- **We read each provider's official status.** Every 5 minutes a cron reads the
  provider's own status page or feed and reports what it says in plain English
  (`lib/services/source-ingestion.ts`).
- **We keep the incidents** from those feeds and link to the original source on
  each one.
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
- `/reliability` — 30-day uptime ranking; `/best/<category>` — most reliable per category
- `/compare/<a>-vs-<b>` — two apps side by side
- `/blog` — outage write-ups
- `/embed` and `/badge/<app-id>` — embeddable live status badges
- `/rss.xml`, `/status.json` — incident feed and the whole board for machines
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

Cron routes under `/api/cron/*` (protected by `CRON_SECRET`): `status` records
each provider's current status and sends any queued email alerts, `ingest`
reads the official incident feeds, `health` emails the owner when a feed goes
stale, and `popularity` reorders the board weekly by search demand. Schedules
live in Cloud Scheduler; results land in Firestore (`incidents`,
`provider_status`, `status_history`, `casual_reports`, `emailSubscriptions`, …).

## License

MIT
