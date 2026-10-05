'use client';

import { useEffect, useState } from 'react';
import { canWebShare, shareOrCopy, copyLink } from '@/lib/utils/share-client';
import { trackEvent } from '@/lib/utils/analytics-client';

// Contextual share prompt, shown only when an app is down/degraded — the moment
// people actually want to pass a status link along ("it's not just you"). Fires
// once per browser: after a share OR a dismiss it never shows again. Small inline
// card, never a blocking modal.
const SEEN_KEY = 'aistatus_share_prompt_v1';

export default function SharePrompt({ text, path }: { text: string; path: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        setShow(true);
        trackEvent('share_prompt_shown', { metadata: { where: 'prompt' } });
      }
    } catch {
      /* private mode / blocked storage: just don't show */
    }
  }, []);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const onShare = async () => {
    const r = canWebShare() ? await shareOrCopy({ text, path, where: 'prompt' }) : await copyLink(path, 'prompt');
    if (r === 'copy_link') {
      setCopied(true);
      setTimeout(close, 1200);
    } else if (r !== 'dismissed') {
      close();
    }
  };

  const onDismiss = () => {
    trackEvent('share_prompt_dismissed', { metadata: { where: 'prompt' } });
    close();
  };

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Share this status"
      className="surface-card p-4 flex flex-wrap items-center justify-between gap-3 max-w-xl mx-auto border-amber-200/70 dark:border-amber-900/50"
    >
      <p className="text-sm text-slate-700 dark:text-slate-200">
        Someone else hitting this? Send them the live status so they know it&apos;s not just them.
      </p>
      <span className="flex items-center gap-2 shrink-0">
        <button type="button" onClick={onShare} className="cta-primary text-xs">
          {copied ? 'Link copied' : canWebShare() ? 'Share' : 'Copy link'}
        </button>
        <button type="button" onClick={onDismiss} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">
          Not now
        </button>
      </span>
    </div>
  );
}
