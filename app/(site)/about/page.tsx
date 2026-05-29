import type { Metadata } from 'next';
import Link from 'next/link';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'About',
    description: 'AIStatusDashboard answers one immediate question: is the provider down for everyone, or only for me?',
    alternates: { canonical: '/about' },
    openGraph: {
      title: 'About | AI Status Dashboard',
      description: 'AIStatusDashboard answers one immediate question: is the provider down for everyone, or only for me?',
    },
    twitter: {
      title: 'About | AI Status Dashboard',
      description: 'AIStatusDashboard answers one immediate question: is the provider down for everyone, or only for me?',
    },
  };
}

export default function AboutPage() {
  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="surface-card-strong p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">About</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">AIStatusDashboard</h1>
        </header>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">What this does</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            AIStatusDashboard answers one immediate question: is the provider down for everyone, or only for me?
            It tracks major AI providers and exposes plain-English status pages, API endpoints, and datasets.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Consumer routes focus on fast decisions during outages, while developer routes expose machine-readable
            data for automation and tooling.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How it works</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Signals are built from official status feeds, normalized incident ingestion, synthetic checks, and
            public evidence envelopes. Casual Mode summarizes the same evidence into direct human guidance.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            For methodology details and verification surfaces, see the public documentation.
          </p>
          <div className="text-sm">
            <Link href="/how-it-works" className="underline">
              Open methodology →
            </Link>
          </div>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Project status</h2>
          <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-5 space-y-1">
            <li>Built by Khalid Saidi.</li>
            <li>Part of a portfolio of agent-readiness tools.</li>
            <li>License: MIT.</li>
            <li>Live since 2026.</li>
          </ul>
          <div className="text-sm space-x-4">
            <a href="https://github.com/aistatusdashboard/aistatusdashboard" className="underline">
              GitHub repository
            </a>
            <Link href="/related" className="underline">
              Related projects
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
