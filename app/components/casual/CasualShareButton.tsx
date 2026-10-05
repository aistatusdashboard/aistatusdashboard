'use client';

import { useEffect, useState } from 'react';
import { canWebShare, shareOrCopy, copyLink } from '@/lib/utils/share-client';

// Permanent share entry point. Shows the OS share sheet where it exists (phones,
// some desktops) and always offers "Copy link" — which is what most desktop
// users actually want. The link is UTM-tagged for attribution.
export default function CasualShareButton({
  text,
  path,
  where = 'app',
}: {
  text: string;
  path: string;
  where?: string;
}) {
  const [share, setShare] = useState(false);
  const [copied, setCopied] = useState(false);

  // Feature-detect on the client only (avoids a hydration mismatch).
  useEffect(() => setShare(canWebShare()), []);

  const onShare = async () => {
    const r = await shareOrCopy({ text, path, where });
    if (r === 'copy_link') flashCopied();
  };
  const onCopy = async () => {
    const r = await copyLink(path, where);
    if (r === 'copy_link') flashCopied();
  };
  const flashCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="inline-flex items-center gap-2">
      {share && (
        <button type="button" onClick={onShare} className="cta-secondary text-xs inline-flex items-center gap-1.5">
          {/* platform-neutral share glyph */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          Share
        </button>
      )}
      <button type="button" onClick={onCopy} className="cta-secondary text-xs">
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </span>
  );
}
