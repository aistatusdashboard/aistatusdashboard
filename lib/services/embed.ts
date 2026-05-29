import { getCasualApp, getCasualStatus } from '@/lib/services/casual';
import { providerService } from '@/lib/services/providers';

export type EmbedStatusPayload = {
  provider: string;
  provider_id: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  headline: string;
  updated_at: string;
  casual_url: string;
};

export async function getEmbedStatus(providerSlug: string): Promise<EmbedStatusPayload | null> {
  const app = getCasualApp(providerSlug);
  if (!app) return null;
  const status = await getCasualStatus({ appId: app.id });
  if (!status) return null;
  const provider = providerService.getProvider(app.providerId);
  const providerLabel = provider?.displayName || provider?.name || app.label.replace(/ Status$/, '');
  return {
    provider: providerLabel,
    provider_id: app.providerId,
    status: status.overall_status,
    headline: status.headline,
    updated_at: status.updated_at,
    casual_url: `https://aistatusdashboard.com/casual/${app.id}`,
  };
}
