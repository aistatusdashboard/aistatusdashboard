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
  generateBuildId: async () => {
    return buildId;
  },
};

module.exports = nextConfig;
