import { statusService } from './status';
import { persistenceService } from './persistence';
import { evaluateAlert } from './alert-state';
import { notificationService } from './notifications';
import { providerService } from './providers';
import { log } from '@/lib/utils/logger';

export class StatusOrchestrator {
    async runCycle(): Promise<{ providersChecked: number; changesDetected: number }> {
        let changesDetected = 0;
        const providers = providerService.getProviders();

        try {
            log('info', `Starting status check cycle for ${providers.length} providers`);

            await Promise.all(providers.map(async (provider) => {
                // 1. Get current status
                const current = await statusService.checkProvider(provider);

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
