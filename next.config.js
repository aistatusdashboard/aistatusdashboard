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
    ];
  },
  generateBuildId: async () => {
    return buildId;
  },
};

module.exports = nextConfig;
