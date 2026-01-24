export const metadata = {
  title: 'Privacy Policy | AI Status Dashboard',
  description: 'Privacy Policy for AI Status Dashboard.',
};

export default function PrivacyPage() {
  return (
    <main className="px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="surface-card p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Legal
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            How AI Status Dashboard handles data and telemetry.
          </p>
        </header>

        <section className="surface-card p-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>
            We collect minimal operational data needed to power status summaries, incidents, and
            reliability insights. We do not collect prompts or response content by default.
          </p>
          <p>
            Anonymous telemetry may include latency, error codes, provider identifiers, and coarse
            region. IP addresses are used transiently for rate limiting and abuse prevention.
          </p>
          <p>
            We do not sell personal data. Data is retained only as long as needed for reliability
            reporting and auditing.
          </p>
          <p>
            If you opt in to account-specific telemetry, data is hashed and stored without personal
            identifiers. You can request removal at any time.
          </p>
          <p>
            Contact: <a className="underline" href="mailto:hello@aistatusdashboard.com">hello@aistatusdashboard.com</a>
          </p>
        </section>
      </div>
    </main>
  );
}
