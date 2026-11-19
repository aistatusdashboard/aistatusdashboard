import appsConfig from '@/lib/casual/apps.json';
import { providerService } from '@/lib/services/providers';
import { evaluateAlert } from '@/lib/services/alert-state';
import { notificationService } from '@/lib/services/notifications';
import { hasScope, type StatusScope } from '@/lib/services/app-scope';
import type { ProviderStatusDoc } from '@/lib/services/provider-status-docs';
import type { ProviderStatus, StatusResult } from '@/lib/types';
import { log } from '@/lib/utils/logger';

// Email alerts, decided from the same reading the pages show.
//
// Alerts used to come from a second, older status check (the "status" cron)
// with its own list of 28 providers. Three things followed from that:
//  - the 11 apps added later (Muse, Bedrock, Suno, ...) were not on its list,
//    so nobody who signed up for them could ever be alerted - Muse had the most
//    confirmed subscribers of any app;
//  - Mistral was still read through a browser job that stopped producing output
//    on 2026-10-28, so the alert system saw "unknown" for weeks while the pages
//    showed its incidents;
//  - a page and its alert could disagree, being two different readers.
// The ingest cron reads every provider the site shows, so alerts now run at the
// end of each ingest cycle over provider_status. The rules (lib/services/
// alert-state.ts: persistence before announcing, unknown never alerts) are
// unchanged.
type AppEntry = { id: string; label: string; providerId: string; statusScope?: StatusScope };
const APPS = appsConfig.apps as AppEntry[];

// Same window the app pages use before they stop trusting a stored reading.
export const ALERT_STALE_MS = 2 * 60 * 60 * 1000;

/** The app a provider's alerts are about: the first one configured for it. */
function primaryApp(providerId: string): AppEntry | undefined {
  return APPS.find((app) => app.providerId === providerId);
}

export function alertName(providerId: string): string {
  const provider = providerService.getProvider(providerId);
  const app = primaryApp(providerId);
  return provider?.displayName || (app ? app.label.replace(/\s+status$/i, '').trim() : '') || provider?.name || providerId;
}

/** The status an alert for this provider should be judged on. A reading that
 *  has gone stale is unknown. When the alert is about an app that is only part
 *  of the provider's page (ChatGPT on OpenAI's), only that app's own reading
 *  counts - never the page-wide status, which is how "ChatGPT is down" was
 *  sent for an API-only incident. */
export function alertStatus(doc: ProviderStatusDoc, nowMs: number): ProviderStatus {
  if (!Number.isFinite(doc.lastUpdatedMs) || nowMs - doc.lastUpdatedMs >= ALERT_STALE_MS) return 'unknown';
  const app = primaryApp(doc.id);
  if (app && hasScope(app.statusScope)) {
    return ((doc.appStatus || {})[app.id] as ProviderStatus) || 'unknown';
  }
  return (doc.status as ProviderStatus) || 'unknown';
}

export async function runAlertCycle(docs: ProviderStatusDoc[], now = new Date()): Promise<{ checked: number; announced: number }> {
  let announced = 0;
  await Promise.all(
    docs.map(async (doc) => {
      try {
        const status = alertStatus(doc, now.getTime());
        const decision = await evaluateAlert(doc.id, status, now);
        if (!decision.notify) return;
        const provider = providerService.getProvider(doc.id);
        const current: StatusResult = {
          id: doc.id,
          name: provider?.name || alertName(doc.id),
          displayName: alertName(doc.id),
          status,
          responseTime: 0,
          lastChecked: now.toISOString(),
          statusPageUrl: provider?.statusPageUrl || '',
        };
        announced++;
        await notificationService.notifyStatusChange(current, { ...current, status: decision.from });
      } catch (error) {
        log('error', 'Alert cycle failed for provider', { error, providerId: doc.id });
      }
    })
  );
  return { checked: docs.length, announced };
}
