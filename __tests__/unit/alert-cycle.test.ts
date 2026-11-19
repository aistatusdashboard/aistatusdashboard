/** @jest-environment node */
import { alertName, alertStatus, ALERT_STALE_MS } from '@/lib/services/alert-cycle';
import { normalizeSeverity, parseStatuspageComponents } from '@/lib/utils/platform-parsers';
import { parseStatusPageResponse } from '@/lib/utils/status-parsers';
import { appStatusesFor } from '@/lib/services/app-scope';
import { appForIncident } from '@/lib/casual/app-lookup';
import appsConfig from '@/lib/casual/apps.json';
import sourcesConfig from '@/lib/data/sources.json';
import providersConfig from '@/lib/data/providers.json';

const NOW = Date.parse('2026-11-19T20:00:00Z');
const doc = (id: string, status: string, appStatus: Record<string, string | null> = {}, ageMs = 60_000) => ({ id, status, appStatus, lastUpdatedMs: NOW - ageMs });

describe('alerts run on the reading the pages show', () => {
  it('covers every provider the site shows an app for', () => {
    // The old alert system had its own list of 28 providers; 11 apps (Muse,
    // Bedrock, Suno, ...) were missing, so their subscribers were never alerted.
    const read = new Set((sourcesConfig.sources as Array<{ providerId: string }>).map((s) => s.providerId));
    const unread = (appsConfig.apps as Array<{ id: string; providerId: string }>).filter((app) => !read.has(app.providerId));
    expect(unread.map((app) => app.id)).toEqual([]);
  });

  it('judges an unscoped provider by its own status, and never by a stale one', () => {
    expect(alertStatus(doc('muse', 'major_outage'), NOW)).toBe('major_outage');
    expect(alertStatus(doc('mistral', 'degraded'), NOW)).toBe('degraded');
    expect(alertStatus(doc('muse', 'major_outage', {}, ALERT_STALE_MS + 1), NOW)).toBe('unknown');
    expect(alertStatus({ id: 'muse', status: 'operational', appStatus: {}, lastUpdatedMs: NaN }, NOW)).toBe('unknown');
  });

  it('judges a provider whose alert is about one app by that app alone', () => {
    // OpenAI page in trouble, ChatGPT fine: nothing to announce for "ChatGPT (OpenAI)".
    expect(alertStatus(doc('openai', 'partial_outage', { chatgpt: 'operational', codex: 'operational' }), NOW)).toBe('operational');
    expect(alertStatus(doc('openai', 'partial_outage', { chatgpt: 'partial_outage' }), NOW)).toBe('partial_outage');
    // No scoped reading: unknown, not the page-wide status.
    expect(alertStatus(doc('openai', 'major_outage', { chatgpt: null }), NOW)).toBe('unknown');
    expect(alertStatus(doc('github', 'major_outage', { copilot: 'operational' }), NOW)).toBe('operational');
  });

  it('names alerts the way subscribers know the app', () => {
    expect(alertName('openai')).toBe('ChatGPT (OpenAI)');
    expect(alertName('muse')).toBe('Muse');
    expect(alertName('sora')).toBe('Sora');
  });

  it('no provider in the old list still depends on the browser job', () => {
    const list = ((providersConfig as any).providers || providersConfig) as Array<{ id: string }>;
    expect(list.length).toBeGreaterThan(0); // the list only supplies display names now
  });
});

describe('Statuspage severity words', () => {
  it('reads "major" as a partial outage and "critical" as the full one', () => {
    expect(normalizeSeverity('major')).toBe('partial_outage');
    expect(normalizeSeverity('critical')).toBe('major_outage');
    expect(normalizeSeverity('minor')).toBe('degraded');
    expect(normalizeSeverity('none')).toBe('operational');
    // Component statuses keep their meaning.
    expect(normalizeSeverity('major_outage')).toBe('major_outage');
    expect(normalizeSeverity('partial_outage')).toBe('partial_outage');
    expect(normalizeSeverity('degraded_performance')).toBe('degraded');
    expect(normalizeSeverity('Major Service Outage')).toBe('major_outage');
    expect(parseStatusPageResponse({ status: { indicator: 'major' } })).toBe('partial_outage');
    expect(parseStatusPageResponse({ status: { indicator: 'critical' } })).toBe('down');
  });
});

describe('apps their provider reports as one part of its page', () => {
  const summary = (overrides: Record<string, string>) => ({
    page: { id: 'p' },
    status: { indicator: 'major', description: 'Partial System Outage' },
    components: [
      { id: 'g-v0', name: 'v0', group: true, status: overrides['v0'] || 'operational' },
      { id: 'c-v0-gen', name: 'Generations', group_id: 'g-v0', status: overrides['Generations'] || 'operational' },
      { id: 'c-builds', name: 'Builds', status: overrides['Builds'] || 'operational' },
      { id: 'c-copilot', name: 'Copilot', status: overrides['Copilot'] || 'operational' },
      { id: 'c-actions', name: 'Actions', status: overrides['Actions'] || 'operational' },
      { id: 'g-canva', name: 'Canva AI Platform', group: true, status: overrides['Canva AI Platform'] || 'operational' },
      { id: 'c-canva-conn', name: 'Canva AI Connector', group_id: 'g-canva', status: overrides['Canva AI Connector'] || 'operational' },
      { id: 'c-designs', name: 'Editing designs', status: overrides['Editing designs'] || 'operational' },
    ],
    incidents: [],
    scheduled_maintenances: [],
  });

  it('GitHub Actions down does not take Copilot down, and Copilot down does', () => {
    expect(appStatusesFor('github', parseStatuspageComponents('github', summary({ Actions: 'major_outage' }))).copilot).toBe('operational');
    expect(appStatusesFor('github', parseStatuspageComponents('github', summary({ Copilot: 'partial_outage' }))).copilot).toBe('partial_outage');
  });

  it('a Vercel build outage does not take v0 down; a part inside the v0 group does', () => {
    expect(appStatusesFor('vercel', parseStatuspageComponents('vercel', summary({ Builds: 'major_outage' }))).v0).toBe('operational');
    expect(appStatusesFor('vercel', parseStatuspageComponents('vercel', summary({ Generations: 'degraded_performance' }))).v0).toBe('degraded');
  });

  it('a Canva editor outage does not take Canva AI down; its own platform does', () => {
    expect(appStatusesFor('canva', parseStatuspageComponents('canva', summary({ 'Editing designs': 'major_outage' })))['canva-ai']).toBe('operational');
    expect(appStatusesFor('canva', parseStatuspageComponents('canva', summary({ 'Canva AI Connector': 'partial_outage' })))['canva-ai']).toBe('partial_outage');
  });
});

describe('which app an incident page is about', () => {
  it('names an API-only OpenAI incident after OpenAI, with no app page to link', () => {
    expect(appForIncident({ providerId: 'openai', scopeApps: [] })).toEqual({ appId: null, appName: 'OpenAI' });
  });
  it('names an incident after the app it touches', () => {
    expect(appForIncident({ providerId: 'openai', scopeApps: ['codex'] })).toEqual({ appId: 'codex', appName: 'OpenAI Codex' });
    expect(appForIncident({ providerId: 'openai', scopeApps: ['chatgpt', 'dots'] }).appId).toBe('chatgpt');
  });
  it('keeps the old behaviour when the incident carries no part information', () => {
    expect(appForIncident({ providerId: 'openai' })).toEqual({ appId: 'chatgpt', appName: 'ChatGPT' });
    expect(appForIncident({ providerId: 'anthropic' }).appId).toBe('claude');
  });
});
