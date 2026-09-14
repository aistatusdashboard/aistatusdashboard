import appsConfig from '@/lib/casual/apps.json';

type AppEntry = { id: string; label: string; providerId: string };

const APPS: AppEntry[] = ((appsConfig as any).apps ?? appsConfig) as AppEntry[];

// First app that maps to a provider (some providers back several apps, e.g.
// openai → chatgpt and sora; the first entry is the canonical one).
export function appIdForProvider(providerId: string): string {
    return APPS.find((app) => app.providerId === providerId)?.id ?? providerId;
}

// Human name for a provider as people know it ("ChatGPT", not "openai").
export function appNameForProvider(providerId: string): string {
    const app = APPS.find((entry) => entry.providerId === providerId);
    if (!app) return providerId;
    return app.label.replace(/\s+status$/i, '').trim();
}
