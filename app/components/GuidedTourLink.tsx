'use client';

export default function GuidedTourLink({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('ai-status:start-tour', { detail: { mode: 'full' } }));
      }}
      className={`whitespace-nowrap leading-none text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition ${className}`}
    >
      Guided tour
    </button>
  );
}
