#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL || 'https://aistatusdashboard.com').replace(/\/$/, '');
const BAD_GENERIC_TITLE = 'AI Status Dashboard - Real-time AI Provider Monitoring';

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

async function resolveIncidentExpectation() {
  const incidentList = await fetchJson('/api/public/v1/incidents');
  const first = incidentList?.data?.incidents?.[0];
  if (!first?.id || !first?.title) {
    throw new Error('[metadata] could not resolve incident id/title from /api/public/v1/incidents');
  }
  const title = `${first.title} — AIStatusDashboard`;
  return {
    route: `/incidents/${encodeURIComponent(first.id)}`,
    expectedTitle: title,
  };
}

async function run() {
  const incident = await resolveIncidentExpectation();
  const routes = [
    {
      route: '/embed',
      expectedTitle: 'Embed Status Widget | AI Status Dashboard',
    },
    {
      route: '/developer',
      expectedTitle: 'Developer hub | AI Status Dashboard',
    },
    {
      route: '/about',
      expectedTitle: 'About | AI Status Dashboard',
    },
    {
      route: '/changelog',
      expectedTitle: 'Changelog | AI Status Dashboard',
    },
    {
      route: '/related',
      expectedTitle: 'Related projects | AI Status Dashboard',
    },
    {
      route: '/casual/chatgpt',
      expectedTitle: 'Is ChatGPT down? Live status — AIStatusDashboard',
    },
    {
      route: '/casual/claude',
      expectedTitle: 'Is Claude down? Live status — AIStatusDashboard',
    },
    {
      route: '/casual/gemini',
      expectedTitle: 'Is Gemini down? Live status — AIStatusDashboard',
    },
    {
      route: incident.route,
      expectedTitle: incident.expectedTitle,
    },
  ];

  for (const item of routes) {
    const html = await fetchText(item.route);
    const ogTitle = extractMetaContent(html, 'og:title');
    const twitterTitle = extractMetaContent(html, 'twitter:title');
    assertEqual(item.route, 'og:title', ogTitle, item.expectedTitle);
    assertEqual(item.route, 'twitter:title', twitterTitle, item.expectedTitle);
    console.log(`[metadata] PASS ${item.route}`);
    console.log(`  og:title=${ogTitle}`);
    console.log(`  twitter:title=${twitterTitle}`);
  }

  console.log('[metadata] all route-specific metadata checks passed');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
