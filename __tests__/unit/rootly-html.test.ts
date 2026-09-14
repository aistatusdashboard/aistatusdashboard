import { extractRootlyComponents, extractRootlyIncidents, extractRootlyOverall, parseRootlyDate } from '@/lib/utils/rootly-html';

const MAIN = `
<main><span class="text-4xl font-semibold text-center">All Systems Operational</span>
<details class="group pointer-events-none"><summary class="px-5"><div class="flex"><span class="icon"></span><h2 class="text-primary-900 truncate"> Agents API </h2></div><span class="text-green-400">Operational</span></summary></details>
<details class="group pointer-events-none"><summary class="px-5"><div class="flex"><span class="icon"></span><h2 class="text-primary-900 truncate"> OCR API </h2></div><span class="text-red-500">Affected</span></summary></details>
</main>`;

const HISTORY = `
<span class="text-base"> Jul 2026 - Sep 2026 </span>
<div data-controller="status-pages--clickable-card" data-status-pages--clickable-card-url-value="https://status.mistral.ai/incidents/8eb8a3a6">
<span class="hover:underline text-lg font-semibold">GLM 5.2 Service Degraded</span>
<div class="text-gray-700 hidden sm:flex"> September 10 at 04:50 PM UTC </div>
<span class="flex text-green-500"><svg></svg><span>Resolved</span></span>
<span class="status-page-markdown-content"><p class="redcarpet">We have rolled out our solution.</p></span>
<div class="sm:hidden"> September 10 at 04:50 PM UTC <div><p>Resolved after 24m</p></div></div></div>
<div data-controller="status-pages--clickable-card" data-status-pages--clickable-card-url-value="https://status.mistral.ai/incidents/abc">
<span class="hover:underline text-lg font-semibold">Console Degraded</span>
<div class="text-gray-700 hidden sm:flex"> July 2 at 07:40 AM UTC </div>
<span class="flex text-yellow-500"><svg></svg><span>Investigating</span></span>
<span class="status-page-markdown-content"><p class="redcarpet">Looking into it.</p></span></div>`;

describe('rootly html extraction', () => {
  it('reads the banner and the service rows', () => {
    expect(extractRootlyOverall(MAIN)).toBe('All Systems Operational');
    expect(extractRootlyComponents(MAIN)).toEqual([
      { name: 'Agents API', status: 'Operational' },
      { name: 'OCR API', status: 'Affected' },
    ]);
  });

  it('reads incident cards with ids, dates from the quarter range, status and duration', () => {
    const incidents = extractRootlyIncidents(HISTORY, new Date('2026-09-14T00:00:00Z'));
    expect(incidents).toHaveLength(2);
    expect(incidents[0]).toMatchObject({
      id: '8eb8a3a6',
      title: 'GLM 5.2 Service Degraded',
      status: 'Resolved',
      message: 'We have rolled out our solution.',
      shownAt: '2026-09-10T16:50:00.000Z',
      durationMinutes: 24,
    });
    expect(incidents[1]).toMatchObject({ id: 'abc', status: 'Investigating', shownAt: '2026-07-02T07:40:00.000Z' });
  });

  it('reads the status word when the icon is a self-closing <svg />', () => {
    const html = HISTORY.replace('<svg></svg><span>Resolved</span>', '<svg class="hero-icon" width="16" />\n<span>Resolved</span>');
    const incidents = extractRootlyIncidents(html, new Date('2026-09-14T00:00:00Z'));
    expect(incidents[0].status).toBe('Resolved');
  });

  it('assigns December to the earlier year when the quarter straddles New Year', () => {
    expect(parseRootlyDate('December 30 at 11:00 PM UTC', 'Nov 2026 - Jan 2027')).toBe('2026-12-30T23:00:00.000Z');
    expect(parseRootlyDate('January 2 at 01:00 AM UTC', 'Nov 2026 - Jan 2027')).toBe('2027-01-02T01:00:00.000Z');
  });
});
