'use client';

import { FormEvent, useState } from 'react';

type NotifyInlineFormProps = {
  providerIds: string[];
  className?: string;
  ctaLabel?: string;
};

export default function NotifyInlineForm({
  providerIds,
  className,
  ctaLabel = 'Notify me when this is fixed',
}: NotifyInlineFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          providers: providerIds,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success === false) {
        setStatus('error');
        setMessage(payload?.message || 'Could not start subscription.');
        return;
      }
      setStatus('success');
      setMessage('Check your inbox to confirm.');
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Could not reach subscription service.');
    }
  }

  return (
    <form onSubmit={onSubmit} className={className || 'space-y-2'}>
      <label className="sr-only" htmlFor={`notify-${providerIds.join('-')}`}>
        Email
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`notify-${providerIds.join('-')}`}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="min-w-[200px] flex-1 rounded-full border border-slate-200/70 dark:border-slate-700/70 px-3 py-2 text-sm bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-white"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 text-sm font-semibold"
        >
          {status === 'loading' ? 'Submitting…' : ctaLabel}
        </button>
      </div>
      {message ? (
        <p
          className={`text-xs ${
            status === 'success'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-rose-700 dark:text-rose-300'
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
