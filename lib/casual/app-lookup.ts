import appsConfig from '@/lib/casual/apps.json';

type AppEntry = { id: string; label: string; providerId: string; providerDisplay?: string };

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

// Which app an incident page is about. Most providers are one product, so it
// is the provider's first app. Where the provider's page covers several
// products and the incident says which parts it touched (OpenAI), it is the
// first app the incident touches - and when it touches none of them (an
// API-only incident) it is the provider itself, with no app to link to.
// Titling such a page "Is ChatGPT down?" was the same mistake as the alert.
export function appForIncident(incident: { providerId: string; scopeApps?: string[] | null }): {
    appId: string | null;
    appName: string;
} {
    const apps = APPS.filter((app) => app.providerId === incident.providerId);
    const name = (app: AppEntry) => app.label.replace(/\s+status$/i, '').trim();
    if (Array.isArray(incident.scopeApps)) {
        const touched = apps.find((app) => incident.scopeApps!.includes(app.id));
        if (touched) return { appId: touched.id, appName: name(touched) };
        return { appId: null, appName: apps[0]?.providerDisplay || incident.providerId };
    }
    if (!apps.length) return { appId: null, appName: incident.providerId };
    return { appId: apps[0].id, appName: name(apps[0]) };
}
