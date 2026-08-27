import type { MetadataRoute } from 'next';
import { listCasualApps } from '@/lib/services/casual';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'always', priority: 1 },
    { url: `${SITE_URL}/incidents`, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${SITE_URL}/reliability`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.1 },
  ];

  const appRoutes: MetadataRoute.Sitemap = listCasualApps().map((app) => ({
    url: `${SITE_URL}/${app.id}`,
    changeFrequency: 'always',
    priority: 0.9,
  }));

  return [...staticRoutes, ...appRoutes];
}
