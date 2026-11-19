/** @jest-environment node */
import { parseIncidentIoSummary, parseIncidentIoIncident } from '@/lib/utils/incidentio-parser';
import {
  alertStatusFromScope,
  appStatusesFor,
  incidentAppliesToApp,
  incidentScopeApps,
  scopedStatus,
  statusForApp,
} from '@/lib/services/app-scope';
import { buildStrip } from '@/lib/services/status-strip';
import appsConfig from '@/lib/casual/apps.json';

// Shaped like status.openai.com's own feed (GET /proxy/status.openai.com).
const page = (affected: Array<{ component_id: string; status: string }>, ongoing: unknown[] = []) => ({
  summary: {
    components: [
      { id: 'c-chat', name: 'Chat Completions' },
      { id: 'c-resp', name: 'Responses' },
      { id: 'c-api-login', name: 'Login' },
      { id: 'c-conv', name: 'Conversations' },
      { id: 'c-gpt-login', name: 'Login' },
      { id: 'c-dots', name: 'dots' },
      { id: 'c-codex', name: 'Codex Web' },
    ],
    structure: {
      items: [
        { group: { name: 'APIs', components: [{ component_id: 'c-chat' }, { component_id: 'c-resp' }, { component_id: 'c-api-login' }] } },
        { group: { name: 'ChatGPT', components: [{ component_id: 'c-conv' }, { component_id: 'c-gpt-login' }, { component_id: 'c-dots' }] } },
        { group: { name: 'Codex', components: [{ component_id: 'c-codex' }] } },
      ],
    },
    affected_components: affected,
    ongoing_incidents: ongoing,
  },
});

const chatgpt = (appsConfig.apps as Array<{ id: string; statusScope?: { groups?: string[]; components?: string[] } }>).find((a) => a.id === 'chatgpt')!;
const NOW = Date.parse('2026-11-19T16:15:00Z');
const FRESH = NOW - 60_000;
const STALE_AFTER = 2 * 60 * 60 * 1000;

describe('app scope', () => {
  // 2026-11-19: "Elevated error rates for gpt-6 Luna API requests" affected
  // Chat Completions and Responses only. The site emailed "ChatGPT (OpenAI) is down".
  it('an API-only outage leaves ChatGPT operational and gives the alert pipeline nothing to announce', () => {
    const { components, status } = parseIncidentIoSummary(
      'openai',
      page([
        { component_id: 'c-chat', status: 'partial_outage' },
        { component_id: 'c-resp', status: 'degraded_performance' },
      ], [{ id: 'inc-1' }])
    );
    // The page as a whole is in trouble...
    expect(status).toBe('partial_outage');
    // ...but ChatGPT's own components are not.
    expect(scopedStatus(chatgpt.statusScope!, components)).toBe('operational');
    const appStatus = appStatusesFor('openai', components);
    expect(appStatus.chatgpt).toBe('operational');
    expect(appStatus.codex).toBe('operational');
    expect(statusForApp({ status, appStatus }, 'chatgpt')).toBe('operational');
    // The alert labelled "ChatGPT (OpenAI)" sees operational: no change, no email.
    expect(alertStatusFromScope(appStatus, 'chatgpt', FRESH, NOW, STALE_AFTER)).toBe('operational');
  });

  it('a ChatGPT outage still reaches ChatGPT, and only ChatGPT', () => {
    const { components } = parseIncidentIoSummary('openai', page([{ component_id: 'c-conv', status: 'full_outage' }], [{ id: 'inc-2' }]));
    const appStatus = appStatusesFor('openai', components);
    expect(appStatus.chatgpt).toBe('major_outage');
    expect(appStatus.codex).toBe('operational');
    expect(alertStatusFromScope(appStatus, 'chatgpt', FRESH, NOW, STALE_AFTER)).toBe('major_outage');
  });

  it('tells the two "Login" components apart by their group', () => {
    const api = parseIncidentIoSummary('openai', page([{ component_id: 'c-api-login', status: 'partial_outage' }])).components;
    expect(appStatusesFor('openai', api).chatgpt).toBe('operational');
    const gpt = parseIncidentIoSummary('openai', page([{ component_id: 'c-gpt-login', status: 'partial_outage' }])).components;
    expect(appStatusesFor('openai', gpt).chatgpt).toBe('partial_outage');
  });

  it('never falls back to the page-wide status for a scoped alert', () => {
    // No reading for the app, or a reading we have not refreshed: unknown, which never alerts.
    expect(alertStatusFromScope({ chatgpt: null }, 'chatgpt', FRESH, NOW, STALE_AFTER)).toBe('unknown');
    expect(alertStatusFromScope(undefined, 'chatgpt', FRESH, NOW, STALE_AFTER)).toBe('unknown');
    expect(alertStatusFromScope({ chatgpt: 'major_outage' }, 'chatgpt', NOW - 3 * 60 * 60 * 1000, NOW, STALE_AFTER)).toBe('unknown');
  });

  it('keeps the provider-wide status for apps without a scope or without a reading', () => {
    expect(statusForApp({ status: 'degraded', appStatus: null }, 'sora')).toBe('degraded');
    expect(statusForApp({ status: 'degraded', appStatus: { chatgpt: null } }, 'chatgpt')).toBe('degraded');
    expect(scopedStatus({ groups: ['Nope'] }, parseIncidentIoSummary('openai', page([])).components)).toBeNull();
  });

  it('lists an incident on an app page only when it touches that app', () => {
    const { components } = parseIncidentIoSummary('openai', page([]));
    const names = new Map(components.map((c) => [c.id, c.name]));
    const incident = (ids: string[]) =>
      parseIncidentIoIncident('openai', 'openai-incidentio', names, {
        id: 'i', name: 'x', status: 'resolved', published_at: '2026-11-19T16:01:00Z',
        affected_components: ids.map((component_id) => ({ component_id, status: 'partial_outage' })),
        updates: [],
      })!;
    const apiOnly = incidentScopeApps('openai', incident(['c-chat', 'c-resp']).impactedComponents, components);
    expect(apiOnly).toEqual([]);
    expect(incidentAppliesToApp({ scopeApps: apiOnly }, chatgpt)).toBe(false);
    const gpt = incidentScopeApps('openai', incident(['c-conv']).impactedComponents, components);
    expect(gpt).toEqual(['chatgpt']);
    expect(incidentAppliesToApp({ scopeApps: gpt }, chatgpt)).toBe(true);
    // dots sits inside the ChatGPT group, so it touches both apps.
    expect(incidentScopeApps('openai', incident(['c-dots']).impactedComponents, components)).toEqual(['chatgpt', 'dots']);
    // An incident that names no components cannot be ruled out for anyone.
    expect(incidentScopeApps('openai', [], components)).toBeUndefined();
    expect(incidentAppliesToApp({}, chatgpt)).toBe(true);
    // An unscoped app sees every incident of its provider.
    expect(incidentAppliesToApp({ scopeApps: [] }, { id: 'sora' })).toBe(true);
  });

  it("colours a scoped app's 30-day bar from its own tally once one exists", () => {
    const now = new Date('2026-11-20T10:00:00Z');
    const strip = buildStrip(
      { days: { '2026-11-20': { openai: { down: 4, up: 100 }, 'app:chatgpt': { up: 104 } }, '2026-11-19': { openai: { wobbly: 7, up: 200 } } } },
      'openai', now, 'chatgpt'
    );
    expect(strip[strip.length - 1].level).toBe('up');        // own tally
    expect(strip[strip.length - 2].level).toBe('wobbly');    // before scoping: provider-wide
    expect(buildStrip({ days: { '2026-11-20': { openai: { down: 4 }, 'app:chatgpt': { up: 9 } } } }, 'openai', now)[29].level).toBe('down');
  });
});
