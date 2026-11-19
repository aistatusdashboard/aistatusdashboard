import { intelligenceService } from '@/lib/services/intelligence';
import { hasScope, incidentAppliesToApp, type StatusScope } from '@/lib/services/app-scope';

type ScopedApp = { id: string; providerId: string; statusScope?: StatusScope };

/** The newest incidents that are about one app. An app that is only part of
 *  its provider's status page (ChatGPT on OpenAI's) drops the provider's other
 *  incidents, so it reads further back to still fill the list. Every list of
 *  "this app's incidents" goes through here: the history page once showed an
 *  API-only incident as ChatGPT's after the app page had stopped doing so. */
export async function getAppIncidents(app: ScopedApp, limit: number) {
  if (!hasScope(app.statusScope)) {
    return intelligenceService.getIncidents({ providerId: app.providerId, limit });
  }
  const rows = await intelligenceService.getIncidents({
    providerId: app.providerId,
    limit: Math.min(200, Math.max(limit * 4, 20)),
  });
  return rows.filter((incident) => incidentAppliesToApp(incident, app)).slice(0, limit);
}
