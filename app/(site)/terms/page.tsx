export const metadata = {
  title: 'Terms of Service | AI Status Dashboard',
  description: 'Terms of Service for AI Status Dashboard.',
};

export default function TermsPage() {
  return (
    <main className="px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="surface-card p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Legal
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-3">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            By using AI Status Dashboard, you agree to these terms.
          </p>
        </header>

        <section className="surface-card p-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>
            AI Status Dashboard provides public status, incident, and telemetry summaries for AI
            providers. Information is provided “as is” for reference only and may be delayed or
            incomplete.
          </p>
          <p>
            You are responsible for verifying any critical decisions. We do not guarantee uptime,
            accuracy, or availability of the service.
          </p>
          <p>
            You may not abuse or overload the public APIs. Automated access must respect published
            rate limits and robots.txt policies.
          </p>
          <p>
            We may update these terms over time. Continued use of the service constitutes
            acceptance of the latest terms.
          </p>
          <p>
            Contact: <a className="underline" href="mailto:hello@aistatusdashboard.com">hello@aistatusdashboard.com</a>
          </p>
        </section>
      </div>
    </main>
  );
}
