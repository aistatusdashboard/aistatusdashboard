import {
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_UPDATED_EVENT,
  getCookieConsentDecision,
  hasCookieConsent,
  setCookieConsentDecision,
} from '@/lib/utils/cookie-consent';
import { trackEvent } from '@/lib/utils/analytics-client';

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

  it('blocks event forwarding without consent', () => {
    const gtag = jest.fn();
    (window as any).gtag = gtag;

    trackEvent('page_view');

    expect(gtag).not.toHaveBeenCalled();
    delete (window as any).gtag;
  });

  it('forwards events to gtag after consent', () => {
    const gtag = jest.fn();
    (window as any).gtag = gtag;
    setCookieConsentDecision('accepted');

    trackEvent('page_view', { metadata: { path: '/chatgpt' } });

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'page_view', { path: '/chatgpt' });
    delete (window as any).gtag;
  });
});
