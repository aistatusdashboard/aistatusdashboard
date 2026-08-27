'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { SyntheticEvent } from 'react';

export default function Logo() {
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = 'none';
  };

  return (
    <Link
      href="/"
      aria-label="AI Status home"
      className="flex items-center gap-2.5 leading-none"
    >
      <Image
        src="/brand/logo-mark.svg"
        width={28}
        height={28}
        alt=""
        priority
        onError={handleError}
        className="shrink-0"
        aria-hidden="true"
      />
      <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
        AI Status
      </span>
    </Link>
  );
}
