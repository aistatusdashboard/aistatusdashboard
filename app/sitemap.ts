import type { MetadataRoute } from 'next';
import { listCasualApps } from '@/lib/services/casual';
import { intelligenceService } from '@/lib/services/intelligence';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com';

// Regenerated every 30 minutes so fresh incidents reach the sitemap while the
// outage is still what people are searching for.
export const revalidate = 1800;

// Incident pages carry more than half of the site's search impressions —
// Google was finding them by chance, since none were listed here.
const INCIDENT_WINDOW_DAYS = 90;
const MAX_INCIDENT_URLS = 1500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  let incidentRoutes: MetadataRoute.Sitemap = [];
  try {
    const since = new Date(Date.now() - INCIDENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const incidents = await intelligenceService.getIncidents({ startDate: since, limit: MAX_INCIDENT_URLS });
    incidentRoutes = incidents.map((incident) => {
      const resolved = Boolean(incident.resolvedAt);
      return {
        url: `${SITE_URL}/incidents/${incident.providerId}:${incident.id}`,
        lastModified: incident.updatedAt ? new Date(incident.updatedAt) : undefined,
        changeFrequency: resolved ? 'monthly' : 'hourly',
        priority: resolved ? 0.5 : 0.8,
      };
    });
  } catch {
    // A sitemap without incidents is still a valid sitemap.
  }

  return [...staticRoutes, ...appRoutes, ...incidentRoutes];
}
