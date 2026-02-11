'use client';

import { useEffect, useRef, useState } from 'react';
import type { StatusResult } from '@/lib/types';
import { getProbeDefaultsMap } from '@/lib/utils/probe-defaults';
import {
  COOKIE_CONSENT_UPDATED_EVENT,
  type CookieConsentDecision,
  getCookieConsentDecision,
  hasCookieConsent,
} from '@/lib/utils/cookie-consent';

declare global {
  interface Window {
    AIStatusSDK?: {
      configure: (options: Record<string, any>) => void;
      report: (metrics: Record<string, any>) => void;
    };
  }
}

const CLIENT_ID_KEY = 'ai-status-client-id';
const ACCOUNT_ID_KEY = 'ai-status-account-id';
const LAST_SENT_KEY = 'ai-status-telemetry-last';
const SAMPLE_WINDOW_MS = 5 * 60 * 1000;
const TELEMETRY_KEY = process.env.NEXT_PUBLIC_TELEMETRY_PUBLIC_KEY || '';

function getOrCreateClientId() {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `client_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.localStorage.setItem(CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return '';
  }
}

function getAccountId() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(ACCOUNT_ID_KEY) || '';
  } catch {
    return '';
  }
}

function shouldSend() {
  if (typeof window === 'undefined') return false;
  try {
    const last = window.localStorage.getItem(LAST_SENT_KEY);
    if (!last) return true;
    const lastMs = Number(last);
    if (!Number.isFinite(lastMs)) return true;
    return Date.now() - lastMs >= SAMPLE_WINDOW_MS;
  } catch {
    return true;
  }
}

function markSent() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
  } catch {}
}

async function sendDirect(payload: Record<string, any>) {
  if (!TELEMETRY_KEY) return;
  try {
    await fetch('/api/telemetry/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telemetry-key': TELEMETRY_KEY,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {}
}

function sendWithSdk(payload: Record<string, any>) {
  const sdk = typeof window !== 'undefined' ? window.AIStatusSDK : undefined;
  if (!sdk?.configure || !sdk?.report) return false;

  sdk.configure({
    telemetryKey: TELEMETRY_KEY,
    clientId: payload.clientId,
    accountId: payload.accountId || null,
    providerId: payload.providerId,
    model: payload.model,
    endpoint: payload.endpoint,
    region: payload.region,
    tier: payload.tier,
    streaming: payload.streaming,
  });
  sdk.report({
    latencyMs: payload.latencyMs,
    http5xxRate: payload.http5xxRate,
    http429Rate: payload.http429Rate,
    tokensPerSec: payload.tokensPerSec,
    streamDisconnectRate: payload.streamDisconnectRate,
  });
  return true;
}

export default function TelemetryBeacon({ statuses }: { statuses: StatusResult[] }) {
  const sentRef = useRef(false);
  const defaultsRef = useRef<Record<string, ReturnType<typeof getProbeDefaultsMap>[string]>>({});
  const [consentDecision, setConsentDecision] = useState<CookieConsentDecision | null>(null);

  useEffect(() => {
    setConsentDecision(getCookieConsentDecision());

    const handleConsentUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ decision?: CookieConsentDecision }>).detail;
      setConsentDecision(detail?.decision || getCookieConsentDecision());
    };

    window.addEventListener(COOKIE_CONSENT_UPDATED_EVENT, handleConsentUpdated as EventListener);
    return () => {
      window.removeEventListener(
        COOKIE_CONSENT_UPDATED_EVENT,
        handleConsentUpdated as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (!statuses?.length) return;
    if (!TELEMETRY_KEY) return;
    if (sentRef.current) return;
    if (!hasCookieConsent()) return;
    if (!shouldSend()) return;

    defaultsRef.current = getProbeDefaultsMap();
    const clientId = getOrCreateClientId();
    if (!clientId) return;
    const accountId = getAccountId();

    const sendPayloads = async () => {
      for (const status of statuses) {
        const defaults = defaultsRef.current[status.id];
        const payload = {
          clientId,
          accountId: accountId || undefined,
          providerId: status.id,
          model: defaults?.model || 'status',
          endpoint: defaults?.endpoint || 'status',
          region: defaults?.region || 'global',
          tier: defaults?.tier || 'unknown',
          streaming: Boolean(defaults?.streaming),
          latencyMs: Number.isFinite(status.responseTime) ? status.responseTime : 0,
        };

        const sent = sendWithSdk(payload);
        if (!sent) {
          await sendDirect(payload);
        }
      }
    };

    sendPayloads().finally(() => {
      sentRef.current = true;
      markSent();
    });
  }, [statuses, consentDecision]);

  return null;
}
