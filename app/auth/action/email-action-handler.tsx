'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';

type Phase = 'checking' | 'reset' | 'verified' | 'recovered' | 'reset-done' | 'error';

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';

async function authRequest(endpoint: string, payload: Record<string, string>) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      referrerPolicy: 'no-referrer',
      redirect: 'error',
    },
  );
  const result = (await response.json()) as { email?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message ?? 'ACTION_FAILED');
  return result;
}

export function EmailActionHandler({ mode, oobCode }: { mode: string; oobCode: string }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Keep the one-time code out of the address bar, browser history, and analytics URLs.
    window.history.replaceState(null, '', window.location.pathname);
    if (started.current) return;
    started.current = true;

    if (!API_KEY || !oobCode) {
      setPhase('error');
      return;
    }

    const verify = async () => {
      try {
        if (mode === 'verifyEmail' || mode === 'recoverEmail') {
          await authRequest('accounts:update', { oobCode });
          setPhase(mode === 'verifyEmail' ? 'verified' : 'recovered');
          return;
        }
        if (mode === 'resetPassword') {
          const result = await authRequest('accounts:resetPassword', { oobCode });
          setEmail(result.email ?? '');
          setPhase('reset');
          return;
        }
        setPhase('error');
      } catch {
        setPhase('error');
      }
    };

    void verify();
  }, [mode, oobCode]);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 6 || password !== confirmation || busy) return;
    setBusy(true);
    try {
      await authRequest('accounts:resetPassword', { oobCode, newPassword: password });
      setPhase('reset-done');
    } catch {
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white p-7 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-9">
      <p className="text-sm font-semibold tracking-wide text-sky-700 dark:text-sky-300">AI STATUS</p>
      {phase === 'checking' && <h1 className="mt-4 text-2xl font-semibold">Checking your link…</h1>}
      {phase === 'verified' && (
        <>
          <h1 className="mt-4 text-2xl font-semibold">Email verified</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">Your email address is confirmed.</p>
        </>
      )}
      {phase === 'recovered' && (
        <>
          <h1 className="mt-4 text-2xl font-semibold">Email change canceled</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">Your previous email address has been restored.</p>
        </>
      )}
      {phase === 'reset' && (
        <>
          <h1 className="mt-4 text-2xl font-semibold">Choose a new password</h1>
          {email && <p className="mt-2 text-slate-600 dark:text-slate-300">For {email}</p>}
          <form className="mt-6 grid gap-4" onSubmit={savePassword}>
            <label className="grid gap-2 text-sm font-medium">
              New password
              <input className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-base dark:border-slate-600" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Confirm password
              <input className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-base dark:border-slate-600" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            {password && confirmation && password !== confirmation && <p role="alert" className="text-sm text-red-700 dark:text-red-300">Passwords do not match.</p>}
            <button className="rounded-lg bg-sky-700 px-4 py-3 font-semibold text-white disabled:opacity-60" type="submit" disabled={busy || password.length < 6 || password !== confirmation}>{busy ? 'Updating…' : 'Update password'}</button>
          </form>
        </>
      )}
      {phase === 'reset-done' && (
        <>
          <h1 className="mt-4 text-2xl font-semibold">Password updated</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">You can close this page and return to AI Status.</p>
        </>
      )}
      {phase === 'error' && (
        <>
          <h1 className="mt-4 text-2xl font-semibold">This link can’t be used</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">It may have expired or already been used. Request a new email link and try again.</p>
        </>
      )}
      <Link className="mt-7 inline-block text-sm font-medium text-sky-700 underline underline-offset-4 dark:text-sky-300" href="/">Return to AI Status</Link>
    </section>
  );
}
