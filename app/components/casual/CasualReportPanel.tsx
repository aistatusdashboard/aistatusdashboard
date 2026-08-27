'use client';

import { useState } from 'react';
import type { ExperienceSurfaceStatus } from '@/lib/types/casual';
import { trackEvent } from '@/lib/utils/analytics-client';

const issueLabels: Record<string, string> = {
  text: 'Text slow / errors',
  images: 'Images failing',
  voice: 'Voice issues',
  browse: 'Browse issues',
  tools: 'Tools failing',
  login: 'Login issues',
  billing: 'Billing issues',
  rate_limits: 'Rate limiting',
};

export default function CasualReportPanel({
  appId,
  surfaces,
}: {
  appId: string;
  surfaces: ExperienceSurfaceStatus[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (surface: string, issue: boolean, issueType?: string) => {
    setSending(true);
    try {
      const res = await fetch('/api/public/v1/casual/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appId, surface, issue, issueType, clientType: 'web' }),
      });
      if (res.ok) {
        setMessage('Thanks for the report.');
        trackEvent('casual_report_submit', { metadata: { appId, surface, issue } });
      } else if (res.status === 429) {
        setMessage('Please wait a few minutes before reporting again.');
      } else {
        setMessage('Unable to record the report right now.');
      }
    } catch {
      setMessage('Unable to record the report right now.');
    } finally {
      setSending(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">Are you having issues?</p>
      <div className="flex flex-wrap gap-2">
        {surfaces.map((surface) => (
          <button
            key={surface.id}
            type="button"
            onClick={() => submit(surface.id, true, issueLabels[surface.id])}
            className="px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            disabled={sending}
          >
            {issueLabels[surface.id] || surface.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => submit('text', false, 'no_issue')}
          className="px-3 py-2 rounded-full border border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-50"
          disabled={sending}
        >
          No issues
        </button>
      </div>
      {message && <p className="text-xs text-slate-500">{message}</p>}
    </div>
  );
}
