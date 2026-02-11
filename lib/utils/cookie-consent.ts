export type CookieConsentDecision = 'accepted' | 'rejected';

export const COOKIE_CONSENT_STORAGE_KEY = 'ai-status-cookie-consent-v1';
export const COOKIE_CONSENT_UPDATED_EVENT = 'ai-status:cookie-consent-updated';
export const COOKIE_CONSENT_OPEN_EVENT = 'ai-status:cookie-consent-open';

interface StoredCookieConsent {
  decision: CookieConsentDecision;
  updatedAt: string;
}

function isCookieConsentDecision(value: unknown): value is CookieConsentDecision {
  return value === 'accepted' || value === 'rejected';
}

export function getCookieConsentDecision(): CookieConsentDecision | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCookieConsent>;
    return isCookieConsentDecision(parsed?.decision) ? parsed.decision : null;
  } catch {
    return null;
  }
}

export function hasCookieConsent(): boolean {
  return getCookieConsentDecision() === 'accepted';
}

export function setCookieConsentDecision(decision: CookieConsentDecision): void {
  if (typeof window === 'undefined') return;

  const nextValue: StoredCookieConsent = {
    decision,
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(nextValue));
  } catch {
    // Ignore storage failures and still notify listeners.
  }

  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_UPDATED_EVENT, {
      detail: { decision },
    })
  );
}

export function openCookieConsentPreferences(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT));
}
