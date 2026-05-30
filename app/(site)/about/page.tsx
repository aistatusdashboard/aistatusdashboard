import type { Metadata } from 'next';
import Link from 'next/link';

export async function generateMetadata(): Promise<Metadata> {
  const description =
    'AI Status Dashboard helps people quickly answer whether an AI provider issue is local or widespread, then provides evidence-backed next steps.';
  return {
    title: 'About',
    description,
    alternates: { canonical: '/about' },
    openGraph: {
      title: 'About | AI Status Dashboard',
      description,
    },
    twitter: {
      title: 'About | AI Status Dashboard',
      description,
    },
  };
}

export default function AboutPage() {
  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="surface-card-strong p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">About</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">AI Status Dashboard</h1>
        </header>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">What this does</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            AI Status Dashboard answers one urgent question fast: is this AI outage affecting everyone, or is it just
            my setup? The product tracks major providers, translates live reliability signals into plain language,
            and gives people a decision in seconds instead of forcing them to parse raw status feeds.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The core experience is intentionally split: Casual Mode is optimized for fast, low-friction answers during
            incident stress, while the developer surface exposes machine-readable status for integrations, automation,
            and routing policy decisions. Both views are generated from the same underlying evidence.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Why this exists</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            When ChatGPT, Claude, or Gemini fail, users usually cannot tell whether the issue is local, regional,
            account-specific, or provider-wide. Official provider pages can lag, and generic monitoring dashboards
            often miss AI-specific surfaces like model routing, tool calls, and conversational latency. Independent,
            AI-focused monitoring closes that gap and gives users a practical “what now?” path during incidents.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The project started from repeated real-world support situations where teams lost time debugging their own
            infrastructure during provider-side incidents. A narrow AI reliability lens reduces that confusion: users
            see current symptoms, expected resolution patterns, and fallback paths in one place.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Who this is for</h2>
          <ul className="text-sm text-slate-600 dark:text-slate-300 list-disc pl-5 space-y-1">
            <li>
              The panicked user: quickly answers “is it just me?” and provides immediate fallback options.
            </li>
            <li>
              The SRE or engineer: exposes reliability data, incidents, and status trends for production decisions.
            </li>
            <li>
              The AI agent: publishes machine-readable status via API, OpenAPI, datasets, and MCP for automated routing.
            </li>
          </ul>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How it works</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            AI Status Dashboard combines official status pages, observed reliability metrics, synthetic checks, and
            crowd signals into a single evidence-backed response. Casual Mode turns that evidence into clear,
            actionable copy for humans. Developer routes expose the same underlying signals for automation.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            For deeper methodology details, evidence contracts, and response schema, use the public docs and API spec.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Every public route is designed for direct ingestion: OpenAPI for typed clients, llms.txt for language-model
            discovery, datasets for independent verification, and MCP for tool-based agent workflows. The goal is to
            make reliability claims auditable, not just readable.
          </p>
          <div className="text-sm">
            <Link href="/how-it-works" className="underline">Open methodology →</Link>
            {' · '}
            <Link href="/openapi.json" className="underline">OpenAPI spec →</Link>
          </div>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How we’re different</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This is not a generic status aggregator. It is purpose-built for AI providers, returns evidence-backed
            responses with confidence scoring, and publishes public datasets plus API and MCP surfaces for programmatic
            use. That combination lets both humans and systems validate claims and act quickly.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            In practical terms: the product focuses on the AI reliability questions people actually ask under pressure,
            keeps machine-readable surfaces synchronized with user-facing pages, and exposes historical context such as
            typical resolution windows. It is built to support both immediate triage and long-term reliability analysis.
          </p>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Project status</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            AI Status Dashboard is built by Khalid Saidi, open-source under MIT, and maintained as part of a broader
            portfolio of agent-readiness tools. Releases and maintenance history are published in the changelog.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Questions or bugs: open an issue in the GitHub repository.
          </p>
          <div className="text-sm space-x-4">
            <a href="https://github.com/aistatusdashboard/aistatusdashboard" className="underline">
              GitHub repository
            </a>
            <Link href="/changelog" className="underline">
              Changelog
            </Link>
            <Link href="/related" className="underline">
              Related projects
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
