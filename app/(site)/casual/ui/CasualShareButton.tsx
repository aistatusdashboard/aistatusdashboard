'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/utils/analytics-client';

export default function CasualShareButton({ summary }: { summary: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      trackEvent('casual_copy_summary');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="cta-secondary text-xs"
    >
      {copied ? 'Copied' : 'Copy status summary'}
    </button>
  );
}
