'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { SyntheticEvent } from 'react';

export default function Logo() {
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget as HTMLImageElement;
    target.style.display = 'none';
    target.closest('[data-logo]')?.setAttribute('data-logo-fallback', 'true');
  };

  return (
    <Link
      href="/"
      aria-label="AI Status Dashboard home"
      className="group flex items-center gap-2.5 text-slate-900 dark:text-white leading-none"
      data-logo
    >
      <Image
        src="/brand/logo-mark.svg"
        width={28}
        height={28}
        alt="AI Status Dashboard"
        priority
        onError={handleError}
        className="shrink-0"
      />
      <Image
        src="/brand/logo-wordmark.svg"
        width={140}
        height={22}
        alt=""
        className="hidden sm:block h-[22px] w-auto translate-y-[1px]"
        aria-hidden="true"
        priority
        onError={handleError}
      />
      <span className="sr-only">AI Status Dashboard</span>
      <span className="hidden text-xs font-semibold text-slate-600 dark:text-slate-300 group-data-[logo-fallback=true]:inline">
        AI Status Dashboard
      </span>
    </Link>
  );
}
