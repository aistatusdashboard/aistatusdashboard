#!/usr/bin/env node
// Regenerate lib/data/demand.json from Google Trends.
//
// Signal: 3-month search interest for "is <app> down", summed and expressed
// relative to "is chatgpt down" = 1.0. This is TRUE public demand (what the
// whole web searches), used as the primary order for the status board. It is
// deliberately NOT our own traffic — our Search Console impressions only break
// ties within an equal demand band (see app/(site)/api/cron/popularity).
//
// Trends has no official API and rate-limits aggressively, so this is a manual,
// occasional refresh (not a cron). Run from the repo root:  node scripts/pull-demand.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CJ = '/tmp/trends_cookies.txt';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36';
const TIME = 'today 3-m';
const ANCHOR = { id: '__anchor__', q: 'is chatgpt down' };

// Search term people actually type for each app (strip " Status"; special-case
// brands whose app id differs from the common search term).
const SPECIAL = {
  'le-chat': 'mistral', 'meta-ai': 'meta ai', copilot: 'github copilot', v0: 'v0 app',
  dots: 'chatgpt dots', comet: 'perplexity comet', 'canva-ai': 'canva', 'notion-ai': 'notion ai',
  'character-ai': 'character ai', bedrock: 'aws bedrock', muse: 'muse ai',
};
const apps = JSON.parse(fs.readFileSync(`${ROOT}/lib/casual/apps.json`, 'utf8')).apps;
const items = apps.map((a) => ({ id: a.id, q: `is ${(SPECIAL[a.id] || a.label.replace(/ Status$/, '')).toLowerCase()} down` }));

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
  source: 'google_trends',
  metric: 'search interest for "is <app> down", 3-month sum, relative to "is chatgpt down" = 1.0',
  note: 'True public search demand (NOT our own traffic). Used as the PRIMARY order for the status board; our GSC impressions only break ties within equal demand bands. Refresh occasionally with scripts/pull-demand (Google Trends).',
  pulledAt: new Date().toISOString().slice(0, 10),
  scores,
};
fs.writeFileSync(`${ROOT}/lib/data/demand.json`, JSON.stringify(out, null, 2) + '\n');
console.error('\nwrote lib/data/demand.json');
apps.map((a) => a.id).sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
  .forEach((id, i) => console.error('  ' + String(i + 1).padStart(2) + '. ' + id.padEnd(14) + (scores[id] || 0).toFixed(4)));
