// Renders official status pages that block plain HTTP clients (Cloudflare
// JavaScript challenge, no JSON/RSS) in a real browser and posts what they
// say to the site, where ingestion treats the snapshot like any other feed.
//
// Runs on a GitHub Actions schedule (.github/workflows/browser-feeds.yml).
// Sources: every entry in lib/data/sources.json with platform "browser".
//
//   SITE_URL     where to post (default https://aistatusdashboard.com)
//   CRON_SECRET  bearer token for /api/ingest/browser-feed
//   DRY_RUN=1    print the snapshots instead of posting

import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const SITE_URL = (process.env.SITE_URL || 'https://aistatusdashboard.com').replace(/\/$/, '');
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

// "September 10 at 04:50 PM UTC" plus the page's "Jul 2026 - Sep 2026" range.
export function parseRootlyDate(text, rangeText, now = new Date()) {
  const m = /([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*UTC/i.exec(text || '');
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  let year = m[3] ? Number(m[3]) : null;
  if (year === null) {
    const range = /([A-Za-z]{3})\s+(\d{4})\s*-\s*([A-Za-z]{3})\s+(\d{4})/.exec(rangeText || '');
    if (range) {
      const startYear = Number(range[2]);
      const endYear = Number(range[4]);
      const endMonth = MONTHS.findIndex((name) => name.startsWith(range[3].toLowerCase()));
      year = month <= endMonth ? endYear : startYear;
    } else {
      year = now.getUTCFullYear();
      if (month > now.getUTCMonth()) year -= 1;
    }
  }
  let hour = Number(m[4]) % 12;
  if (m[6].toUpperCase() === 'PM') hour += 12;
  return new Date(Date.UTC(year, month, Number(m[2]), hour, Number(m[5]))).toISOString();
}

export function parseDuration(text) {
  const m = /after\s+(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i.exec(text || '');
  if (!m) return undefined;
  const minutes = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return minutes > 0 ? minutes : undefined;
}

async function settle(page, url) {
  // The challenge occasionally stalls on a datacenter IP; one reload usually clears it.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Cloudflare's non-interactive challenge swaps the document once solved.
    const solved = await page
      .waitForFunction(() => !/just a moment/i.test(document.title), { timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(2_000);
    if (solved) return;
  }
}

async function readRootly(page, source) {
  const base = source.baseUrl.replace(/\/$/, '');
  await settle(page, `${base}/`);
  const main = await page.evaluate(() => {
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    const banner = document.querySelector('main .text-4xl');
    const components = Array.from(document.querySelectorAll('main details.group > summary')).map((summary) => ({
      name: text(summary.querySelector('h2')),
      status: text(summary.querySelector(':scope > span:last-child')),
    }));
    return {
      overall: text(banner),
      components,
      title: document.title,
      excerpt: text(document.body).slice(0, 240),
    };
  });
  if (!main.overall && !main.components.length) {
    throw new Error(`Page rendered without a status banner or services (title "${main.title}", body "${main.excerpt}")`);
  }

  await settle(page, source.metadata?.historyUrl || `${base}/history`);
  const history = await page.evaluate(() => {
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    const range = text(document.querySelector('#quarterly_incident_history section span'));
    const cards = Array.from(document.querySelectorAll('[data-status-pages--clickable-card-url-value]')).map((card) => {
      const url = card.getAttribute('data-status-pages--clickable-card-url-value') || '';
      const title = text(card.querySelector('.font-semibold'));
      const shown = text(card.querySelector('.hidden.sm\\:flex')) || text(card.querySelector('.sm\\:hidden'));
      const status = text(card.querySelector('.flex-shrink-0 > span'));
      const message = text(card.querySelector('.status-page-markdown-content'));
      const duration = text(card.querySelector('.sm\\:hidden p'));
      return { url, title, shown, status, message, duration };
    });
    return { range, cards };
  });

  const incidents = history.cards
    .map((card) => {
      const shownAt = parseRootlyDate(card.shown, history.range);
      if (!shownAt || !card.title) return null;
      const id = (card.url.match(/\/incidents\/([^/?#]+)/) || [])[1] || `${card.title}-${shownAt}`;
      return {
        id,
        url: card.url || undefined,
        title: card.title,
        status: card.status,
        message: card.message || undefined,
        shownAt,
        durationMinutes: parseDuration(card.duration),
      };
    })
    .filter(Boolean);

  return {
    sourceId: source.id,
    providerId: source.providerId,
    platform: 'rootly',
    fetchedAt: new Date().toISOString(),
    overall: main.overall,
    components: main.components.filter((c) => c.name),
    incidents,
  };
}

async function main() {
  const config = JSON.parse(await readFile(new URL('../lib/data/sources.json', import.meta.url), 'utf8'));
  const sources = (config.sources || []).filter((s) => s.platform === 'browser');
  if (!sources.length) {
    console.log('No browser sources configured.');
    return;
  }
  const browser = await chromium.launch({ headless: true });
  const snapshots = [];
  try {
    for (const source of sources) {
      const page = await browser.newPage({ userAgent: USER_AGENT });
      try {
        const kind = source.metadata?.browser || 'rootly';
        if (kind !== 'rootly') throw new Error(`Unsupported browser feed kind: ${kind}`);
        const snapshot = await readRootly(page, source);
        snapshots.push(snapshot);
        console.log(`${source.id}: "${snapshot.overall}", ${snapshot.components.length} services, ${snapshot.incidents.length} incidents`);
      } catch (error) {
        console.error(`${source.id}: ${error.message}`);
        process.exitCode = 1;
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (!snapshots.length) return;
  if (process.env.DRY_RUN) {
    console.log(JSON.stringify(snapshots, null, 2));
    return;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error('CRON_SECRET is not set');
  const response = await fetch(`${SITE_URL}/api/ingest/browser-feed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
    body: JSON.stringify(snapshots),
  });
  const body = await response.text();
  console.log(`POST /api/ingest/browser-feed → ${response.status} ${body.slice(0, 200)}`);
  if (!response.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
