const buildId =
  process.env.APP_BUILD_ID ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  `build-${Date.now()}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeServerReact: true,
  },
  outputFileTracingRoot: __dirname,
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: '/discovery/audit',
        destination: '/discovery/audit/index.html',
      },
    ];
  },
  async headers() {
    const commonHeaders = [
      { key: 'X-Discovery-Handler', value: 'static' },
      { key: 'X-Discovery-Build', value: buildId },
      { key: 'X-Discovery-Runtime', value: 'static' },
    ];
    const robotsIndexHeader = { key: 'X-Robots-Tag', value: 'index, follow' };
    const cacheHeader = { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' };

    return [
      {
        source: '/.well-known/:path*',
        headers: [robotsIndexHeader],
      },
      {
        source: '/discovery/audit',
        headers: [robotsIndexHeader],
      },
      {
        source: '/discovery/audit/:path*',
        headers: [robotsIndexHeader],
      },
      {
        source: '/datasets/:path*',
        headers: [robotsIndexHeader],
      },
      {
        source: '/docs/:path*',
        headers: [robotsIndexHeader],
      },
      {
        source:
          '/:path(air\\.json|agent\\.json|ai-plugin\\.json|llms\\.txt|llms-full\\.txt|openapi\\.json|openapi\\.yaml|openapi-3\\.0\\.json|openapi-3\\.0\\.yaml|robots\\.txt|sitemap\\.xml|rss\\.xml|docs\\.md|status\\.md|providers\\.md|terms\\.md|privacy\\.md|cookies\\.md)',
        headers: [robotsIndexHeader],
      },
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Content-Type', value: 'application/xml; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' },
          ...commonHeaders,
        ],
      },
      {
        source: '/rss.xml',
        headers: [
          { key: 'Content-Type', value: 'application/rss+xml; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
          ...commonHeaders,
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' },
          ...commonHeaders,
        ],
      },
      {
        source: '/openapi.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=600, s-maxage=1200' },
          ...commonHeaders,
        ],
      },
      {
        source: '/openapi-3.0.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=600, s-maxage=1200' },
          ...commonHeaders,
        ],
      },
      {
        source: '/openapi.yaml',
        headers: [
          { key: 'Content-Type', value: 'application/yaml; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=600, s-maxage=1200' },
          ...commonHeaders,
        ],
      },
      {
        source: '/.well-known/openapi.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=600, s-maxage=1200' },
          ...commonHeaders,
        ],
      },
      {
        source: '/.well-known/ai-plugin.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=600, s-maxage=1200' },
          ...commonHeaders,
        ],
      },
      {
        source: '/air.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' },
          ...commonHeaders,
        ],
      },
      {
        source: '/.well-known/air.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' },
          ...commonHeaders,
        ],
      },
      {
        source: '/openapi-3.0.yaml',
        headers: [
          { key: 'Content-Type', value: 'application/yaml; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=600, s-maxage=1200' },
          ...commonHeaders,
        ],
      },
      {
        source: '/llms.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' },
          ...commonHeaders,
        ],
      },
      {
        source: '/llms-full.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' },
          ...commonHeaders,
        ],
      },
      {
        source: '/docs.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/docs/api.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/docs/citations.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/docs/agent/mcp-quickstart.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/docs/discoverability-audit.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/status.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/providers.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/datasets/incidents.ndjson',
        headers: [
          { key: 'Content-Type', value: 'application/x-ndjson; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
          ...commonHeaders,
        ],
      },
      {
        source: '/datasets/metrics.csv',
        headers: [
          { key: 'Content-Type', value: 'text/csv; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
          ...commonHeaders,
        ],
      },
      {
        source: '/discovery/audit/latest.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
          ...commonHeaders,
        ],
      },
      {
        source: '/discovery/audit',
        headers: [
          { key: 'Content-Type', value: 'text/html; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' },
          ...commonHeaders,
        ],
      },
    ];
  },
  // Skip 404 page generation to avoid Pages Router conflict
  generateBuildId: async () => {
    return buildId;
  },
};

module.exports = nextConfig;
