import type { Metadata } from 'next';
import Link from 'next/link';
import { footerProjectsFor } from '@/lib/cross-project';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Related projects',
    description: 'Portfolio of agent-readiness tools alongside AI Status Dashboard.',
    alternates: { canonical: '/related' },
    openGraph: {
      title: 'Related projects | AI Status Dashboard',
      description: 'Portfolio of agent-readiness tools alongside AI Status Dashboard.',
    },
    twitter: {
      title: 'Related projects | AI Status Dashboard',
      description: 'Portfolio of agent-readiness tools alongside AI Status Dashboard.',
    },
  };
}

export default function RelatedPage() {
  const siblings = footerProjectsFor('aistatusdashboard');
  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="surface-card-strong p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Related
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">
            Portfolio context
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            AI Status Dashboard is part of a portfolio of projects focused on agent reliability, routing,
            and discoverability.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {siblings.map((project) => (
            <article key={project.key} className="surface-card p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{project.name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{project.description}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <a className="underline" href={project.url}>
                  Homepage
                </a>
                <a className="underline" href={project.statsUrl}>
                  Stats
                </a>
                <a className="underline" href={project.agentCardUrl}>
                  Agent card
                </a>
              </div>
            </article>
          ))}
        </section>

        <p className="text-sm">
          <Link href="/" className="underline">
            Back to homepage
          </Link>
        </p>
      </div>
    </main>
  );
}
