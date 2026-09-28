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
  async redirects() {
    return [
      // The old "casual mode" URLs are now the primary app pages.
      { source: '/casual', destination: '/', permanent: true },
      { source: '/casual/:appId', destination: '/:appId', permanent: true },
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/providers', destination: '/', permanent: true },
      // These two legacy provider URLs still rank (Search Console: /provider/aws
      // is pos ~4 for "bedrock status", ~1.2k impressions). Point them at their
      // new app pages to transfer that equity instead of dumping it on the home
      // page. Must precede the /provider/:id catch-all.
      { source: '/provider/aws', destination: '/bedrock', permanent: true },
      { source: '/provider/cerebras', destination: '/cerebras', permanent: true },
      { source: '/provider/:id', destination: '/', permanent: true },
      { source: '/developer', destination: '/', permanent: true },
      { source: '/status', destination: '/', permanent: true },
      // Recover link equity from the torn-down developer-era URL families
      // (Search Console shows ~150 of these as 404s).
      { source: '/docs', destination: '/how-it-works', permanent: true },
      { source: '/docs/:path*', destination: '/how-it-works', permanent: true },
      { source: '/datasets', destination: '/reliability', permanent: true },
      { source: '/datasets/:path*', destination: '/reliability', permanent: true },
      { source: '/metrics', destination: '/reliability', permanent: true },
      { source: '/metrics/:path*', destination: '/reliability', permanent: true },
      { source: '/reports/:path*', destination: '/reliability', permanent: true },
      { source: '/stats', destination: '/reliability', permanent: true },
      { source: '/embed', destination: '/', permanent: true },
      { source: '/embed/:path*', destination: '/', permanent: true },
      { source: '/discovery/:path*', destination: '/', permanent: true },
      { source: '/related', destination: '/about', permanent: true },
      { source: '/changelog', destination: '/incidents', permanent: true },
      { source: '/system-health', destination: '/', permanent: true },
      { source: '/ai', destination: '/about', permanent: true },
      { source: '/mcp', destination: '/about', permanent: true },
    ];
  },
  async headers() {
    // Security + trust headers (were entirely absent). CSP is intentionally
    // permissive for the allowed CDNs/analytics rather than strict, to harden
    // without breaking inline Next.js/gtag scripts.
    const security = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com",
          "frame-ancestors 'self'",
          "base-uri 'self'",
        ].join('; '),
      },
    ];
    // #147: an explicit public Cache-Control for /status.json was tried here
    // and made things worse — App Hosting overrode it to `no-store`, killing
    // even the server-side revalidate cache. Removed. The endpoint keeps its
    // route-level `revalidate = 60` (App Hosting stamps it `private`, but the
    // 60s server-side ISR cache still spares the container). This cap is at the
    // App Hosting / CDN layer, not something the app can override.
    return [{ source: '/:path*', headers: security }];
  },
  generateBuildId: async () => {
    return buildId;
  },
};

module.exports = nextConfig;
