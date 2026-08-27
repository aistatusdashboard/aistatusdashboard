import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How AI Status decides whether ChatGPT, Claude, Gemini, and other AI apps are down: our own live tests, official incident feeds, and reports from people like you.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorksPage() {
  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            How we know when your AI is down
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            Every verdict on this site combines three independent signals. When they disagree, we
            tell you that too.
          </p>
        </header>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">We test the services ourselves</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Every few minutes we send real requests to the AI services we watch and measure whether
            they answer, how fast, and whether they error. Official status pages are often the last
            to admit a problem — our own tests notice first.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">We watch the official feeds</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            We continuously read each provider&apos;s official status page and incident feed, and we
            link to the original source on every incident so you can verify it yourself.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">People like you report in</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Each app page has one button: &ldquo;it&apos;s broken for me too.&rdquo; Enough reports in a short
            window tips the verdict from &ldquo;probably just you&rdquo; to &ldquo;others are seeing this too.&rdquo;
            Reports are anonymous and we filter out noise and our own test traffic.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">When we don&apos;t know, we say so</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            If we can&apos;t verify a service — the status page won&apos;t load, our tests can&apos;t run — we
            show &ldquo;checking&rdquo;, never a green light we can&apos;t back up.
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
