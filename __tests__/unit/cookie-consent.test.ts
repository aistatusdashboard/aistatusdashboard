import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_UPDATED_EVENT,
  getCookieConsentDecision,
  hasCookieConsent,
  setCookieConsentDecision,
} from '@/lib/utils/cookie-consent';
import { getAnalyticsSessionId, trackEvent } from '@/lib/utils/analytics-client';

describe('cookie consent', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
  });

  it('defaults to no decision', () => {
    expect(getCookieConsentDecision()).toBeNull();
    expect(hasCookieConsent()).toBe(false);
  });

  it('stores and reads consent decision', () => {
    setCookieConsentDecision('accepted');

    expect(getCookieConsentDecision()).toBe('accepted');
    expect(hasCookieConsent()).toBe(true);

    const storedRaw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    expect(JSON.parse(storedRaw as string)).toMatchObject({ decision: 'accepted' });
  });

  it('emits a window event when decision changes', () => {
    const listener = jest.fn();
    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, listener as EventListener);

    setCookieConsentDecision('rejected');

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(COOKIE_CONSENT_UPDATED_EVENT, listener as EventListener);
  });

  it('blocks analytics session and tracking without consent', () => {
    expect(getAnalyticsSessionId()).toBeNull();

    trackEvent('page_view');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows analytics session and tracking after consent', () => {
    setCookieConsentDecision('accepted');

    const sessionId = getAnalyticsSessionId();
    expect(sessionId).toBeTruthy();

    trackEvent('page_view', { metadata: { path: '/dashboard' } });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/analytics/track',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
