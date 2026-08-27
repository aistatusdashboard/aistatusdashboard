export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for AI Status.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <main className="px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            By using AI Status, you agree to these terms.
          </p>
        </header>

        <section className="surface-card p-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>
            AI Status shows live status and outage history for AI apps and services. Information is
            provided &ldquo;as is&rdquo; for reference only and may be delayed or incomplete.
          </p>
          <p>
            You are responsible for verifying any critical decisions against official provider
            sources. We do not guarantee uptime, accuracy, or availability of this service.
          </p>
          <p>
            Don&apos;t abuse the site: no scraping at disruptive rates, no spamming the report
            button, and automated access must respect robots.txt.
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
