import { normalizePathname, shouldRenderLiveStatusStrip, shouldRenderStatusPill } from '@/lib/ui/status-chrome';

describe('status chrome route gating', () => {
  it('renders the live strip on live-status routes only', () => {
    const enabled = ['/', '/providers', '/casual', '/casual/chatgpt', '/incidents', '/incidents/openai:abc', '/dashboard', '/dashboard?tab=notifications'];
    const disabled = ['/embed', '/developer', '/about', '/changelog', '/related', '/docs/api', '/terms', '/privacy', '/cookies', '/how-it-works'];

    enabled.forEach((route) => {
      expect(shouldRenderLiveStatusStrip(route)).toBe(true);
    });

    disabled.forEach((route) => {
      expect(shouldRenderLiveStatusStrip(route)).toBe(false);
    });
  });

  it('normalizes query/hash paths before route checks', () => {
    expect(normalizePathname('/dashboard?tab=analytics')).toBe('/dashboard');
    expect(normalizePathname('/casual/chatgpt#top')).toBe('/casual/chatgpt');
  });
});

describe('status chrome placeholder suppression', () => {
  it('rejects unknown or incomplete values so Unknown/— placeholders never render in status chrome', () => {
    expect(
      shouldRenderStatusPill({
        status: 'unknown',
        lastUpdated: '2026-05-29T00:00:00.000Z',
        communityReports: 0,
      })
    ).toBe(false);

    expect(
      shouldRenderStatusPill({
        status: 'operational',
        lastUpdated: null,
        communityReports: 0,
      })
    ).toBe(false);

    expect(
      shouldRenderStatusPill({
        status: 'operational',
        lastUpdated: '2026-05-29T00:00:00.000Z',
        communityReports: null,
      })
    ).toBe(false);

    expect(
      shouldRenderStatusPill({
        status: 'degraded',
        lastUpdated: '2026-05-29T00:00:00.000Z',
        communityReports: 3,
      })
    ).toBe(true);
  });
});
