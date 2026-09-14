'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// The confirm and unsubscribe endpoints redirect to the homepage with a
// query flag. Without this, clicking "Turn on alerts" landed on a page that
// said nothing — success and an expired link looked identical.
export default function SubscriptionNotice() {
  const params = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const confirmed = params.get('confirmed');
  const unsubscribed = params.get('unsubscribed');

  useEffect(() => {
    setDismissed(false);
  }, [confirmed, unsubscribed]);

  if (dismissed || (confirmed === null && unsubscribed === null)) return null;

  let tone = 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100';
  let title = 'Alerts are on.';
  let body = "We'll email you when it breaks — and again when it's back. Nothing else.";

  if (confirmed === 'false') {
    tone = 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
    title = 'That link has expired.';
    body = 'Enter your email below and we will send a fresh one.';
  } else if (unsubscribed === 'true') {
    tone = 'border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100';
    title = "You're unsubscribed.";
    body = 'No more alert emails. Sign up again any time.';
  }

  return (
    <div
      role="status"
      className={`mb-6 flex items-start justify-between gap-4 rounded-2xl border px-4 py-3 text-sm ${tone}`}
    >
      <p>
        <span className="font-semibold">{title}</span> {body}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 rounded-md px-2 text-lg leading-none opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
