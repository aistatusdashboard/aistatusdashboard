'use client';

import { useEffect } from 'react';

// Maximum-coverage interaction tracking, forwarded to GA4 via gtag — the SAME
// official path as @next/third-parties (no second analytics library). One
// delegated capture-phase listener records every meaningful click (links,
// buttons, role=button, [data-track]) with context, so every surface is
// instrumented without hand-wiring each element. Consent Mode still governs
// storage; GA4 Enhanced Measurement adds page_view, scroll, outbound and search
// on top. Fully defensive — analytics must never break the page.
function actionable(node: EventTarget | null): HTMLElement | null {
  let n = node as HTMLElement | null;
  while (n && n !== document.body) {
    if (n.matches?.('a,button,[role="button"],[data-track]')) return n;
    n = n.parentElement;
  }
  return null;
}

export default function InteractionTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      try {
        const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
        if (typeof gtag !== 'function') return;
        const target = actionable(e.target);
        if (!target) return;

        const link = target.closest('a');
        const href = link?.getAttribute('href') || undefined;
        const text =
          (target.getAttribute('aria-label') || target.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) ||
          undefined;
        const section =
          target.closest('[data-section]')?.getAttribute('data-section') ||
          (target.closest('header')
            ? 'header'
            : target.closest('footer')
              ? 'footer'
              : target.closest('nav')
                ? 'nav'
                : 'main');
        const outbound = href ? /^https?:\/\//i.test(href) && !href.includes(window.location.host) : false;

        gtag('event', target.getAttribute('data-track') || 'ui_click', {
          link_url: href,
          link_text: text,
          element: target.tagName.toLowerCase(),
          section,
          outbound,
        });
      } catch {
        /* never break the page for analytics */
      }
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
