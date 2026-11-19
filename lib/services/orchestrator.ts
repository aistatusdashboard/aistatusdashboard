import { statusService } from './status';
import { persistenceService } from './persistence';
import { evaluateAlert } from './alert-state';
import { notificationService } from './notifications';
import { providerService } from './providers';
import { log } from '@/lib/utils/logger';
import { getDb } from '@/lib/db/firestore';
import { alertStatusFromScope } from './app-scope';
import type { ProviderStatus } from '@/lib/types';

// Same window the app pages use before they stop trusting a stored reading.
const SCOPE_STALE_MS = 2 * 60 * 60 * 1000;

async function scopedAlertStatus(providerId: string, appId: string): Promise<ProviderStatus> {
    try {
        const snapshot = await getDb().collection('provider_status').doc(providerId).get();
        const data = snapshot.data() || {};
        const lastUpdatedMs = data.lastUpdated?.toDate?.()?.getTime?.() ?? NaN;
        return alertStatusFromScope(data.appStatus, appId, lastUpdatedMs, Date.now(), SCOPE_STALE_MS) as ProviderStatus;
    } catch (error) {
        log('warn', 'Scoped alert status unavailable; treating as unknown', { error, providerId, appId });
        return 'unknown';
    }
}

export class StatusOrchestrator {
    async runCycle(): Promise<{ providersChecked: number; changesDetected: number }> {
        let changesDetected = 0;
        const providers = providerService.getProviders();

        try {
            log('info', `Starting status check cycle for ${providers.length} providers`);

            await Promise.all(providers.map(async (provider) => {
                // 1. Get current status
                let current = await statusService.checkProvider(provider);
                // A provider whose alerts carry one app's name ("ChatGPT
                // (OpenAI)") is judged by that app's components, not the whole
                // status page - otherwise an API-only incident emails
                // "ChatGPT is down".
                if (provider.alertApp) {
                    current = { ...current, status: await scopedAlertStatus(provider.id, provider.alertApp) };
                }

                // 2. Decide whether this is an announceable change (persisted,
                //    not a feed hiccup, not already announced) and notify.
                const decision = await evaluateAlert(provider.id, current.status);
                if (decision.notify) {
                    changesDetected++;
                    await notificationService.notifyStatusChange(current, { ...current, status: decision.from });
                }

                // 4. Persist result
                await persistenceService.saveStatus(current);
            }));

            log('info', 'Status check cycle complete', { providersChecked: providers.length, changesDetected });
            return { providersChecked: providers.length, changesDetected };
        } catch (error) {
            log('error', 'Status orchestrator cycle failed', { error });
            throw error;
        }
    }
}

export const statusOrchestrator = new StatusOrchestrator();
