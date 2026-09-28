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
      // The developer-era /provider/<id> pages were the site's biggest traffic
      // source (June 2026: /provider/aws alone did 510 clicks / 6.5k impressions
      // on "aws bedrock status"). The rebuild blanket-redirected them all to the
      // home page, throwing that equity away. Map each to its real app page so
      // the ranking transfers to a page that actually answers the query. These
      // must precede the /provider/:id catch-all.
      { source: "/provider/openai", destination: "/chatgpt", permanent: true },
      { source: "/provider/anthropic", destination: "/claude", permanent: true },
      { source: "/provider/gemini", destination: "/gemini", permanent: true },
      { source: "/provider/google", destination: "/gemini", permanent: true },
      { source: "/provider/xai", destination: "/grok", permanent: true },
      { source: "/provider/perplexity", destination: "/perplexity", permanent: true },
      { source: "/provider/deepseek", destination: "/deepseek", permanent: true },
      { source: "/provider/meta", destination: "/meta-ai", permanent: true },
      { source: "/provider/github", destination: "/copilot", permanent: true },
      { source: "/provider/cursor", destination: "/cursor", permanent: true },
      { source: "/provider/character-ai", destination: "/character-ai", permanent: true },
      { source: "/provider/mistral", destination: "/le-chat", permanent: true },
      { source: "/provider/elevenlabs", destination: "/elevenlabs", permanent: true },
      { source: "/provider/lovable", destination: "/lovable", permanent: true },
      { source: "/provider/midjourney", destination: "/midjourney", permanent: true },
      { source: "/provider/poe", destination: "/poe", permanent: true },
      { source: "/provider/windsurf", destination: "/windsurf", permanent: true },
      { source: "/provider/vercel", destination: "/v0", permanent: true },
      { source: "/provider/notion", destination: "/notion-ai", permanent: true },
      { source: "/provider/runway", destination: "/runway", permanent: true },
      { source: "/provider/ideogram", destination: "/ideogram", permanent: true },
      { source: "/provider/grammarly", destination: "/grammarly", permanent: true },
      { source: "/provider/moonshot", destination: "/kimi", permanent: true },
      { source: "/provider/manus", destination: "/manus", permanent: true },
      { source: "/provider/minimax", destination: "/minimax", permanent: true },
      { source: "/provider/canva", destination: "/canva-ai", permanent: true },
      { source: "/provider/muse", destination: "/muse", permanent: true },
      { source: "/provider/heygen", destination: "/heygen", permanent: true },
      { source: "/provider/synthesia", destination: "/synthesia", permanent: true },
      { source: "/provider/aws", destination: "/bedrock", permanent: true },
      { source: "/provider/cerebras", destination: "/cerebras", permanent: true },
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
