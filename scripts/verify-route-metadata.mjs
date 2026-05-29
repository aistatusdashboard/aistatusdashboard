#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL || 'https://aistatusdashboard.com').replace(/\/$/, '');
const BAD_GENERIC_TITLE = 'AI Status Dashboard - Real-time AI Provider Monitoring';
const BAD_DOUBLE_TITLES = [
  'AI Status Dashboard | AI Status Dashboard',
  'AIStatusDashboard | AI Status Dashboard',
];

function buildUrl(path) {
  const cb = Date.now().toString();
  return `${BASE_URL}${path}${path.includes('?') ? '&' : '?'}cb=${cb}`;
}

async function fetchText(path) {
  const url = buildUrl(path);
  const res = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error(`[metadata] ${path} returned HTTP ${res.status}`);
  }
  return res.text();
}

async function fetchJson(path) {
  const url = buildUrl(path);
  const res = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error(`[metadata] ${path} returned HTTP ${res.status}`);
  }
  return res.json();
}

function extractMetaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match?.[1]?.trim() || null;
}

function assertEqual(route, field, actual, expected) {
  if (!actual) {
    throw new Error(`[metadata] ${route} missing ${field}`);
  }
  if (actual !== expected) {
    throw new Error(`[metadata] ${route} ${field} mismatch. expected="${expected}" actual="${actual}"`);
  }
  if (actual === BAD_GENERIC_TITLE) {
    throw new Error(`[metadata] ${route} ${field} fell back to forbidden generic title`);
  }
}

function assertNoDoubleBrand(route, title) {
  for (const bad of BAD_DOUBLE_TITLES) {
    if (title.includes(bad)) {
      throw new Error(`[metadata] ${route} visible <title> contains doubled brand: "${title}"`);
    }
  }
}

async function resolveIncidentExpectation() {
  const incidentList = await fetchJson('/api/public/v1/incidents');
  const first = incidentList?.data?.incidents?.[0];
  if (!first?.id || !first?.title) {
    throw new Error('[metadata] could not resolve incident id/title from /api/public/v1/incidents');
  }
  const visibleTitle = `${first.title} | AI Status Dashboard`;
  return {
    route: `/incidents/${encodeURIComponent(first.id)}`,
    expectedShareTitle: visibleTitle,
    expectedVisibleTitle: visibleTitle,
  };
}

async function run() {
  const incident = await resolveIncidentExpectation();
  const routes = [
    {
      route: '/',
      expectedShareTitle: 'AI Status — is ChatGPT, Claude, or Gemini down right now?',
      expectedVisibleTitle: 'AI Status — is ChatGPT, Claude, or Gemini down right now?',
    },
    {
      route: '/embed',
      expectedShareTitle: 'Embed Status Widget | AI Status Dashboard',
      expectedVisibleTitle: 'Embed Status Widget | AI Status Dashboard',
    },
    {
      route: '/developer',
      expectedShareTitle: 'Developer hub | AI Status Dashboard',
      expectedVisibleTitle: 'Developer hub | AI Status Dashboard',
    },
    {
      route: '/about',
      expectedShareTitle: 'About | AI Status Dashboard',
      expectedVisibleTitle: 'About | AI Status Dashboard',
    },
    {
      route: '/changelog',
      expectedShareTitle: 'Changelog | AI Status Dashboard',
      expectedVisibleTitle: 'Changelog | AI Status Dashboard',
    },
    {
      route: '/related',
      expectedShareTitle: 'Related projects | AI Status Dashboard',
      expectedVisibleTitle: 'Related projects | AI Status Dashboard',
    },
    {
      route: '/casual/chatgpt',
      expectedShareTitle: 'Is ChatGPT down? Live status | AI Status Dashboard',
      expectedVisibleTitle: 'Is ChatGPT down? Live status | AI Status Dashboard',
    },
    {
      route: '/casual/claude',
      expectedShareTitle: 'Is Claude down? Live status | AI Status Dashboard',
      expectedVisibleTitle: 'Is Claude down? Live status | AI Status Dashboard',
    },
    {
      route: '/casual/gemini',
      expectedShareTitle: 'Is Gemini down? Live status | AI Status Dashboard',
      expectedVisibleTitle: 'Is Gemini down? Live status | AI Status Dashboard',
    },
    {
      route: incident.route,
      expectedShareTitle: incident.expectedShareTitle,
      expectedVisibleTitle: incident.expectedVisibleTitle,
    },
  ];

  for (const item of routes) {
    const html = await fetchText(item.route);
    const ogTitle = extractMetaContent(html, 'og:title');
    const twitterTitle = extractMetaContent(html, 'twitter:title');
    const visibleTitle = extractTitle(html);

    assertEqual(item.route, 'og:title', ogTitle, item.expectedShareTitle);
    assertEqual(item.route, 'twitter:title', twitterTitle, item.expectedShareTitle);
    assertEqual(item.route, '<title>', visibleTitle, item.expectedVisibleTitle);
    assertNoDoubleBrand(item.route, visibleTitle);
    console.log(`[metadata] PASS ${item.route}`);
    console.log(`  <title>=${visibleTitle}`);
    console.log(`  og:title=${ogTitle}`);
    console.log(`  twitter:title=${twitterTitle}`);
  }

  console.log('[metadata] all route-specific metadata checks passed');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
