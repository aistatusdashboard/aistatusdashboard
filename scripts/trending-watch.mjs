#!/usr/bin/env node
/**
 * Trending-AI watch — demand-driven candidate finder for new "is X down" pages.
 *
 * It does NOT invent pages or scrape a trend feed. It mines our OWN Google
 * Search Console for outage-intent queries ("is X down", "X outage",
 * "X not working", "X status") about products we do NOT yet have a page for,
 * ranked by impressions. That keeps us firmly on the right side of Google's
 * scaled-content-abuse policy: every candidate is a real product that real
 * people are already searching for — we are responding to measured demand,
 * not mass-producing templated pages.
 *
 * Output is a ranked SHORTLIST for a human to approve. Nothing is published.
 * The reality bar (a real, fetchable status source) is enforced at add-time,
 * in sources.json — no source, no page.
 *
 * Run from the repo root:
 *   GOOGLE_CLOUD_PROJECT=ai-status-dashboard node scripts/trending-watch.mjs [days]
 */
import { GoogleAuth, Impersonated } from 'google-auth-library';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SA = 'ga-admin@ai-status-dashboard.iam.gserviceaccount.com';
const SITE = 'https://aistatusdashboard.com/';
const DAYS = Number(process.argv[2]) || 28;
const here = dirname(fileURLToPath(import.meta.url));

// --- outage intent + the filler we strip to isolate the product name ---------
const INTENT = /\b(down|outage|outages|offline|not\s+working|isn'?t\s+working|status|servers?\s+down|having\s+issues)\b/i;
const FILLER = new Set([
  'is', 'are', 'am', 'the', 'a', 'an', 'it', 'why', 'when', 'did', 'do', 'does',
  'down', 'outage', 'outages', 'offline', 'not', 'working', 'status', 'right',
  'now', 'today', 'currently', 'server', 'servers', 'error', 'errors', 'issue',
  'issues', 'problem', 'problems', 'crash', 'crashed', 'slow', 'having', 'app',
  'ai', 'to', 'of', 'and', 'for', 'again', 'still', 'me', 'my', 'in', 'on',
]);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

function subjectOf(query) {
  const tokens = norm(query).split(' ').filter((t) => t && !FILLER.has(t));
  return tokens.join(' ').trim();
}

// --- build the set of products we already cover (to exclude) ------------------
function knownTokens() {
  const raw = JSON.parse(readFileSync(join(here, '..', 'lib', 'casual', 'apps.json'), 'utf8'));
  const apps = Array.isArray(raw) ? raw : raw.apps || [];
  const toks = new Set();
  for (const a of apps) {
    for (const t of [
      norm(String(a.id || '').replace(/-/g, ' ')),
      norm(String(a.label || '').replace(/status/i, '')),
      norm(String(a.providerDisplay || '')),
      norm(String(a.providerId || '').replace(/-/g, ' ')),
    ]) if (t) toks.add(t);
    try {
      const host = new URL(a.webUrl).hostname.replace(/^www\./, '');
      toks.add(norm(host.split('.')[0]));
    } catch {}
  }
  return toks;
}

function isKnown(subject, toks) {
  if (!subject) return true;
  for (const t of toks) {
    if (!t || t.length < 3) continue;
    if (subject === t || subject.includes(t) || t.includes(subject)) return true;
  }
  return false;
}

// --- GSC ----------------------------------------------------------------------
async function gsc() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const imp = new Impersonated({
    sourceClient: await auth.getClient(),
    targetPrincipal: SA,
    lifetime: 300,
    targetScopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  const end = new Date(); end.setDate(end.getDate() - 1);
  const start = new Date(); start.setDate(start.getDate() - DAYS);
  const f = (d) => d.toISOString().slice(0, 10);
  const r = await imp.request({
    url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
    method: 'POST',
    data: { startDate: f(start), endDate: f(end), dimensions: ['query'], rowLimit: 5000 },
  });
  return r.data.rows || [];
}

// --- main ---------------------------------------------------------------------
const toks = knownTokens();
const rows = await gsc();
const cand = new Map(); // subject -> { impr, clk, pos, samples:Set }
for (const row of rows) {
  const q = row.keys[0];
  if (!INTENT.test(q)) continue;
  const subj = subjectOf(q);
  if (subj.length < 3 || subj.split(' ').length > 4) continue; // junk / too vague
  if (isKnown(subj, toks)) continue;
  const c = cand.get(subj) || { impr: 0, clk: 0, pos: 0, n: 0, samples: new Set() };
  c.impr += row.impressions; c.clk += row.clicks; c.pos += row.position * row.impressions; c.n += row.impressions;
  if (c.samples.size < 3) c.samples.add(q);
  cand.set(subj, c);
}

const ranked = [...cand.entries()]
  .map(([subj, c]) => ({ subj, impr: c.impr, clk: c.clk, pos: c.n ? c.pos / c.n : 0, samples: [...c.samples] }))
  .filter((c) => c.impr >= 2)
  .sort((a, b) => b.impr - a.impr)
  .slice(0, 30);

console.log(`\nTrending-AI watch — outage-intent demand for products we DON'T cover`);
console.log(`Source: our Search Console, last ${DAYS} days. Nothing published; this is a shortlist to approve.\n`);
if (!ranked.length) {
  console.log('No uncovered outage-intent demand this period. (Good — coverage is current.)');
} else {
  console.log('impr  clk  avgPos  candidate            sample queries');
  console.log('----  ---  ------  -------------------  --------------');
  for (const c of ranked) {
    console.log(
      `${String(c.impr).padStart(4)}  ${String(c.clk).padStart(3)}  ${c.pos.toFixed(1).padStart(6)}  ` +
      `${c.subj.padEnd(19).slice(0, 19)}  ${c.samples.join('  |  ')}`
    );
  }
  console.log(`\nNext: for any you want, confirm it has a real status source, then I add it to apps.json + sources.json.`);
}
