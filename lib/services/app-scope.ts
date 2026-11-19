import appsConfig from '@/lib/casual/apps.json';
import type { NormalizedSeverity } from '@/lib/types/ingestion';

// One provider can publish one status page for several products. OpenAI's page
// covers the developer APIs, ChatGPT, Codex and more, each as its own group of
// components. Showing the page-wide status as "ChatGPT" told subscribers
// "ChatGPT is down" during an incident OpenAI scoped to two API components
// (2026-11-19, "Elevated error rates for gpt-6 Luna API requests").
//
// An app may therefore declare which of its provider's components are *it*:
//   "statusScope": { "groups": ["ChatGPT"] }      // every component in a group
//   "statusScope": { "components": ["dots"] }      // named components
// The app's status is then the worst status among those components - still
// exactly what the provider reports, just for the product the page is about.
// Apps without a scope keep the provider-wide status.
export type StatusScope = { groups?: string[]; components?: string[] };

type ScopedApp = { id: string; providerId: string; statusScope?: StatusScope };
type ComponentLike = { id?: string; name: string; groupName?: string; status: NormalizedSeverity | string };

const RANK: Record<string, number> = {
  operational: 0,
  unknown: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

const same = (a: string | undefined, b: string) => String(a || '').trim().toLowerCase() === b.trim().toLowerCase();

export function hasScope(scope: StatusScope | undefined): scope is StatusScope {
  return Boolean(scope && ((scope.groups && scope.groups.length) || (scope.components && scope.components.length)));
}

export function componentInScope(scope: StatusScope, component: { name: string; groupName?: string }): boolean {
  if ((scope.groups || []).some((group) => same(component.groupName, group))) return true;
  return (scope.components || []).some((name) => same(component.name, name));
}

/** Worst status among the app's components, or null when the provider's feed
 *  exposes none of them (the caller then has no scoped reading at all). */
export function scopedStatus(scope: StatusScope, components: ComponentLike[]): NormalizedSeverity | null {
  const mine = components.filter((component) => componentInScope(scope, component));
  if (!mine.length) return null;
  return mine.reduce<NormalizedSeverity>((worst, component) => {
    const status = String(component.status) as NormalizedSeverity;
    return (RANK[status] ?? 0) > (RANK[worst] ?? 0) ? status : worst;
  }, 'operational');
}

export function scopedAppsForProvider(providerId: string): ScopedApp[] {
  return (appsConfig.apps as ScopedApp[]).filter((app) => app.providerId === providerId && hasScope(app.statusScope));
}

/** Per-app status for every scoped app of a provider. Every scoped app id is
 *  always present (null = no reading), so a stored map never keeps a stale key. */
export function appStatusesFor(providerId: string, components: ComponentLike[]): Record<string, NormalizedSeverity | null> {
  const out: Record<string, NormalizedSeverity | null> = {};
  for (const app of scopedAppsForProvider(providerId)) {
    out[app.id] = scopedStatus(app.statusScope as StatusScope, components);
  }
  return out;
}

/** Which scoped apps an incident touches. Undefined when the incident names no
 *  components - then nobody can say it is not about a given app. */
export function incidentScopeApps(
  providerId: string,
  impactedComponentIds: string[] | undefined,
  components: ComponentLike[]
): string[] | undefined {
  const apps = scopedAppsForProvider(providerId);
  if (!apps.length || !impactedComponentIds || !impactedComponentIds.length) return undefined;
  const byId = new Map(components.map((component) => [String(component.id), component]));
  const impacted = impactedComponentIds.map((id) => byId.get(String(id))).filter(Boolean) as ComponentLike[];
  if (!impacted.length) return undefined;
  return apps
    .filter((app) => impacted.some((component) => componentInScope(app.statusScope as StatusScope, component)))
    .map((app) => app.id);
}

/** The status to show for an app: its scoped reading when the provider gives
 *  one, otherwise the provider-wide status. */
export function statusForApp(
  summary: { status?: string; appStatus?: Record<string, string | null> | null } | undefined,
  appId: string
): string | undefined {
  const scoped = summary?.appStatus?.[appId];
  return scoped || summary?.status;
}

/** Whether an incident belongs on an app's page. Incidents that carry no
 *  component information, and apps without a scope, always match. */
export function incidentAppliesToApp(incident: { scopeApps?: string[] | null }, app: { id: string; statusScope?: StatusScope }): boolean {
  if (!hasScope(app.statusScope)) return true;
  if (!Array.isArray(incident.scopeApps)) return true;
  return incident.scopeApps.includes(app.id);
}

/** The status the alert pipeline should use for a provider whose alerts are
 *  labelled with one app ("ChatGPT (OpenAI)"). Without a fresh scoped reading
 *  the answer is unknown - which never alerts - rather than the page-wide
 *  status, because announcing another product's outage is the bug. */
export function alertStatusFromScope(
  appStatus: Record<string, string | null> | null | undefined,
  appId: string,
  lastUpdatedMs: number,
  nowMs: number,
  staleAfterMs: number
): NormalizedSeverity {
  if (!Number.isFinite(lastUpdatedMs) || nowMs - lastUpdatedMs >= staleAfterMs) return 'unknown';
  const scoped = appStatus?.[appId];
  return scoped ? (scoped as NormalizedSeverity) : 'unknown';
}
