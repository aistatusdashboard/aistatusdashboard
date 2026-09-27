// Shared OpenGraph base. Next.js does not deep-merge a page's openGraph with
// the root layout's, so any page that sets openGraph must include these or it
// loses og:site_name / og:locale. Spread this into every page's openGraph.
export const OG_BASE = {
  siteName: 'AI Status',
  locale: 'en_US',
} as const;
