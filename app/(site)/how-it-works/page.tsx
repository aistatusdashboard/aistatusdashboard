import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How AI Status reports whether ChatGPT, Claude, Gemini, and other AI apps are down: each provider\'s official status page, read every five minutes and put in plain English.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorksPage() {
  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            How this site works
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            One place for the official status of every major AI app — read from each provider&apos;s
            own page every five minutes and put in plain English. Nothing is added or guessed.
          </p>
        </header>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">We read the official pages</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Every five minutes we read each provider&apos;s official status page and incident feed,
            in whatever format they publish it, and link to the original source on every incident so
            you can verify it yourself. Where a provider publishes no status page, we read the public
            endpoint they do expose and say that&apos;s what we&apos;re reading.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">People like you report in</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Each app page has one button: &ldquo;it&apos;s broken for me too.&rdquo; Enough reports in a short
            window flips &ldquo;probably just you&rdquo; to &ldquo;others are seeing this too&rdquo; — shown next to
            the official status, never mixed into it. Reports are anonymous and we filter out noise.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">When we don&apos;t know, we say so</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            If a provider&apos;s page won&apos;t load, or they publish nothing at all, we show
            &ldquo;unknown&rdquo; — never a green light nobody reported.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/" className="cta-secondary text-xs">
              See the live board
            </Link>
            <Link href="/incidents" className="cta-secondary text-xs">
              Browse outage history
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
