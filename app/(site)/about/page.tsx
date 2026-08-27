import type { Metadata } from 'next';
import Link from 'next/link';

const description =
  'AI Status answers one question fast: is your AI app down, or is it just you? Independent live tests, official incident feeds, and user reports — in plain English.';

export const metadata: Metadata = {
  title: 'About',
  description,
  alternates: { canonical: '/about' },
  openGraph: { title: 'About | AI Status', description },
  twitter: { title: 'About | AI Status', description },
};

export default function AboutPage() {
  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            About AI Status
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            One question, answered fast: is your AI down, or is it just you?
          </p>
        </header>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Why this exists</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            When ChatGPT stops replying mid-conversation, you don&apos;t want a wall of engineering
            jargon — you want to know if it&apos;s broken for everyone, how long outages like this
            usually last, and what you can use in the meantime. Official status pages are often the
            last place to admit a problem. That gap is why this site exists.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            We independently test ChatGPT, Claude, Gemini, and the other AI apps people actually
            use, every few minutes, and translate what we see into plain English.{' '}
            <Link href="/how-it-works" className="underline">Here&apos;s exactly how</Link>.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Who runs it</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            AI Status is built and run by Khalid Saidi. It is independent and not affiliated with
            any AI provider.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Found a bug or have a suggestion? Open an issue on{' '}
            <a href="https://github.com/aistatusdashboard/aistatusdashboard" className="underline">
              GitHub
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
