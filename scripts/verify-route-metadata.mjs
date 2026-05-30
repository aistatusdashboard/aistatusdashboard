#!/usr/bin/env node

const BASE_URL = (process.env.BASE_URL || 'https://aistatusdashboard.com').replace(/\/$/, '');
const METADATA_ROUTE_SET = (process.env.METADATA_ROUTE_SET || 'full').toLowerCase();
const BAD_GENERIC_TITLE = 'AI Status Dashboard - Real-time AI Provider Monitoring';
const MACHINE_BRAND = 'AIStatusDashboard';
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

function extractBodyVisibleText(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch?.[1] || '';
  const withoutIgnoredBlocks = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ');
  return withoutIgnoredBlocks
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function assertNoMachineBrandInVisibleBody(route, html) {
  const text = extractBodyVisibleText(html);
  if (text.includes(MACHINE_BRAND)) {
    throw new Error(
      `[metadata] ${route} contains disallowed machine-form brand in visible body text: "${MACHINE_BRAND}"`
    );
  }
}

function assertCasualRouteHasEmailInput(route, html) {
  if (!route.startsWith('/casual/')) return;
  if (!/<input[^>]*type=["']email["'][^>]*>/i.test(html)) {
    throw new Error(`[metadata] ${route} is missing required notify email input`);
  }
}

function assertEmbedCopyButtons(route, html) {
  if (route !== '/embed') return;
  const copyButtons = [...html.matchAll(/<button[^>]*aria-label=["'][^"']*copy[^"']*["'][^>]*>/gi)];
  if (copyButtons.length < 3) {
    throw new Error(
      `[metadata] ${route} expected at least 3 copy buttons with aria-label containing "Copy", found ${copyButtons.length}`
    );
  }
}

function assertNoDeadTwitterHandle(route, html) {
  const forbiddenPatterns = [
    /@aistatusdash\b/i,
    /https?:\/\/(?:www\.)?twitter\.com\/aistatusdash(?:[/?#]|$)/i,
    /https?:\/\/(?:www\.)?x\.com\/aistatusdash(?:[/?#]|$)/i,
    /<meta[^>]+name=["']twitter:creator["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:site["'][^>]*>/i,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(html)) {
      throw new Error(
        `[metadata] ${route} contains forbidden dead Twitter reference matching ${pattern}`
      );
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
  const staticRoutes = [
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
  ];

  const fullRoutes = async () => {
    const incident = await resolveIncidentExpectation();
    return [
      {
        route: '/',
        expectedShareTitle: 'AI Status — is ChatGPT, Claude, or Gemini down right now?',
        expectedVisibleTitle: 'AI Status — is ChatGPT, Claude, or Gemini down right now?',
      },
      ...staticRoutes,
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
  };

  const routes = METADATA_ROUTE_SET === 'static' ? staticRoutes : await fullRoutes();

  for (const item of routes) {
    const html = await fetchText(item.route);
    const ogTitle = extractMetaContent(html, 'og:title');
    const twitterTitle = extractMetaContent(html, 'twitter:title');
    const visibleTitle = extractTitle(html);

    assertEqual(item.route, 'og:title', ogTitle, item.expectedShareTitle);
    assertEqual(item.route, 'twitter:title', twitterTitle, item.expectedShareTitle);
    assertEqual(item.route, '<title>', visibleTitle, item.expectedVisibleTitle);
    assertNoDoubleBrand(item.route, visibleTitle);
    assertNoMachineBrandInVisibleBody(item.route, html);
    assertNoDeadTwitterHandle(item.route, html);
    assertCasualRouteHasEmailInput(item.route, html);
    assertEmbedCopyButtons(item.route, html);
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
