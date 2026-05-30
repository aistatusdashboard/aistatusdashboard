'use client';

import { useState } from 'react';

type CodeSnippetProps = {
  code: string;
  ariaLabel: string;
  className?: string;
};

export default function CodeSnippet({ code, ariaLabel, className }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={onCopy}
        aria-label={ariaLabel}
        className="absolute right-2 top-2 rounded-md border border-slate-300/80 dark:border-slate-600/80 bg-white/90 dark:bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 pr-20 overflow-x-auto text-xs">{code}</pre>
    </div>
  );
}
