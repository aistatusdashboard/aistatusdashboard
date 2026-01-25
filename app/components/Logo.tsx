'use client';

export default function Logo() {
  const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget as HTMLImageElement;
    target.style.display = 'none';
    target.closest('[data-logo]')?.setAttribute('data-logo-fallback', 'true');
  };

  return (
    <a
      href="/"
      aria-label="AI Status Dashboard home"
      className="group flex items-center gap-2.5 text-slate-900 dark:text-white leading-none"
      data-logo
    >
      <img
        src="/brand/logo-mark.svg"
        width="28"
        height="28"
        alt="AI Status Dashboard"
        loading="eager"
        decoding="async"
        onError={handleError}
        className="shrink-0"
      />
      <img
        src="/brand/logo-wordmark.svg"
        height="22"
        alt=""
        aria-hidden="true"
        className="hidden sm:block h-[22px] w-auto translate-y-[1px]"
        loading="eager"
        decoding="async"
        onError={handleError}
      />
      <span className="sr-only">AI Status Dashboard</span>
      <span className="hidden text-xs font-semibold text-slate-600 dark:text-slate-300 group-data-[logo-fallback=true]:inline">
        AI Status Dashboard
      </span>
    </a>
  );
}
