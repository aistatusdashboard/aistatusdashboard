'use client';

import { useState } from 'react';

// A read-only code field with a copy button. Used on /embed so people can grab a
// badge snippet in one click — the easier the copy, the more embeds (= backlinks).
export default function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (e.g. insecure context) — the text is still selectable */
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-slate-900 px-3 py-2 text-xs text-slate-200 dark:bg-slate-950">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {copied ? 'Copied ✓' : `Copy ${label}`}
      </button>
    </div>
  );
}
