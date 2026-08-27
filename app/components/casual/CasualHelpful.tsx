'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/utils/analytics-client';

export default function CasualHelpful({ appId }: { appId: string }) {
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);

  const respond = (value: 'yes' | 'no') => {
    setAnswer(value);
    trackEvent('casual_helpful', { metadata: { appId, helpful: value === 'yes' } });
  };

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>Was this helpful?</span>
      <button
        type="button"
        onClick={() => respond('yes')}
        className={`px-2 py-1 rounded-full border ${answer === 'yes' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => respond('no')}
        className={`px-2 py-1 rounded-full border ${answer === 'no' ? 'bg-rose-100 border-rose-200 text-rose-700' : 'border-slate-200 text-slate-600'}`}
      >
        No
      </button>
    </div>
  );
}
