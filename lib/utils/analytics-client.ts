import { hasCookieConsent } from '@/lib/utils/cookie-consent';

const SESSION_KEY = 'ai_status_session_v1';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function getAnalyticsSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  if (!hasCookieConsent()) return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored && typeof stored.id === 'string' && typeof stored.expiresAt === 'number') {
        if (stored.expiresAt > Date.now()) {
          const refreshed = { id: stored.id, expiresAt: Date.now() + SESSION_TTL_MS };
          window.localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
          return stored.id;
        }
      }
    }
  } catch {
    // Ignore storage errors and fall back to a new session.
  }

  const id = generateSessionId();
  try {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id, expiresAt: Date.now() + SESSION_TTL_MS })
    );
  } catch {
    // Ignore storage errors.
  }

  return id;
}

export function trackEvent(
  event: string,
  options: { providerId?: string; metadata?: Record<string, any> } = {}
): void {
  if (typeof window === 'undefined') return;
  if (!hasCookieConsent()) return;

  const sessionId = getAnalyticsSessionId();
  const payload = {
    event,
    providerId: options.providerId,
    sessionId: sessionId || undefined,
    metadata: options.metadata || {},
    timestamp: new Date().toISOString(),
  };

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/track', blob);
      return;
    }
  } catch {
    // Fall back to fetch.
  }

  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
