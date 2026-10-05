#!/usr/bin/env node
// Regenerate lib/data/demand.json from Google Trends.
//
// Signal: 3-month general search POPULARITY per AI product, relative to
// ChatGPT = 1.0. This is TRUE public interest (what the whole web searches),
// the primary order for the status board's head. ChatGPT's dominance crushes
// everything below the top tier under Trends' resolution, so only the head
// resolves; the cron falls back to measured GSC demand below TREND_FLOOR.
//
// NOTE: Trends rate-limits datacenter IPs hard (this box gets a 302 "sorry"
// page). Run it from a residential IP, or pull in-browser on trends.google.com
// via the page's own /trends/api fetch (same session, not blocked). Anchor each
// batch DIRECTLY on "chatgpt" — do NOT chain through low-volume bridges (the
// error compounds into nonsense). Run from the repo root: node scripts/pull-demand.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CJ = '/tmp/trends_cookies.txt';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36';
const TIME = 'today 3-m';
const ANCHOR = { id: '__anchor__', q: 'chatgpt' };

// Disambiguated product term per app (so "cursor" means the AI editor, etc.).
const SPECIAL = {
  gemini: 'gemini ai', claude: 'claude ai', grok: 'grok ai', cursor: 'cursor ai', sora: 'sora ai',
  copilot: 'github copilot', 'character-ai': 'character.ai', 'le-chat': 'mistral ai', v0: 'v0 vercel',
  dots: 'openai dots', comet: 'perplexity comet', 'canva-ai': 'canva ai', 'notion-ai': 'notion ai',
  'meta-ai': 'meta ai', bedrock: 'amazon bedrock', muse: 'muse ai', kimi: 'kimi ai', manus: 'manus ai',
  minimax: 'minimax ai', lovable: 'lovable ai', windsurf: 'windsurf ai', ideogram: 'ideogram ai',
};
const apps = JSON.parse(fs.readFileSync(`${ROOT}/lib/casual/apps.json`, 'utf8')).apps;
const items = apps.map((a) => ({ id: a.id, q: (SPECIAL[a.id] || a.label.replace(/ Status$/, '')).toLowerCase() }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function curlGet(url, params) {
  const args = Object.entries(params).map(([k, v]) => `--data-urlencode ${JSON.stringify(`${k}=${v}`)}`).join(' ');
  const cmd = `curl -s -m 25 -b ${CJ} -c ${CJ} -G ${JSON.stringify(url)} ${args} -H ${JSON.stringify('User-Agent: ' + UA)}`;
  return execSync(cmd, { maxBuffer: 1024 * 1024 * 8 }).toString();
}
const strip = (s) => JSON.parse(s.slice(s.indexOf('{')));

// Prime a Trends session cookie (otherwise the API returns 429).
execSync(`curl -s -m 15 -c ${CJ} -o /dev/null "https://trends.google.com/trends/explore" -H ${JSON.stringify('User-Agent: ' + UA)}`);

async function batchInterest(batch) {
  const req = { comparisonItem: batch.map((b) => ({ keyword: b.q, geo: '', time: TIME })), category: 0, property: '' };
  const exp = strip(curlGet('https://trends.google.com/trends/api/explore', { hl: 'en-US', tz: '0', req: JSON.stringify(req) }));
  const w = (exp.widgets || []).find((x) => x.id === 'TIMESERIES');
  if (!w) throw new Error('no TIMESERIES widget');
  await sleep(2500);
  const ml = strip(curlGet('https://trends.google.com/trends/api/widgetdata/multiline', { hl: 'en-US', tz: '0', req: JSON.stringify(w.request), token: w.token }));
  const sums = batch.map(() => 0);
  (ml.default.timelineData || []).forEach((pt) => pt.value.forEach((v, i) => (sums[i] += v)));
  return sums;
}

const scores = {};
const chunks = [];
for (let i = 0; i < items.length; i += 4) chunks.push(items.slice(i, i + 4));
for (const [bi, chunk] of chunks.entries()) {
  const batch = [ANCHOR, ...chunk];
  try {
    const sums = await batchInterest(batch);
    const anchorVal = sums[0] || 1;
    chunk.forEach((app, j) => { scores[app.id] = Math.round((sums[j + 1] / anchorVal) * 10000) / 10000; });
    console.error(`batch ${bi + 1}/${chunks.length} ok`);
  } catch (e) {
    console.error(`batch ${bi + 1} failed (${e.message}) — rerun; existing scores kept`);
    chunk.forEach((app) => { if (scores[app.id] == null) scores[app.id] = 0; });
  }
  await sleep(3000);
}
scores.chatgpt = 1;

const out = {
  source: 'google_trends_popularity',
  metric: 'general search interest for each AI product, 3-month, relative to ChatGPT = 1.0',
  note: 'True public search POPULARITY (how much the whole web searches each tool), pulled via Google Trends. ChatGPT crushes everything below the top tier under Trends resolution, so only the head resolves reliably; below TREND_FLOOR the board falls back to measured GSC demand. Refresh from a residential IP / in-browser.',
  pulledAt: new Date().toISOString().slice(0, 10),
  scores,
};
fs.writeFileSync(`${ROOT}/lib/data/demand.json`, JSON.stringify(out, null, 2) + '\n');
console.error('\nwrote lib/data/demand.json');
apps.map((a) => a.id).sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
  .forEach((id, i) => console.error('  ' + String(i + 1).padStart(2) + '. ' + id.padEnd(14) + (scores[id] || 0).toFixed(4)));
