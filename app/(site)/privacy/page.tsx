export const metadata = {
  title: 'Privacy Policy',
  description: 'How AI Status handles your data: minimal by design, nothing sold, analytics only with your consent.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <main className="px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            Minimal by design: this site works without an account and collects as little as possible.
          </p>
        </header>

        <section className="surface-card p-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <p>
            <strong className="text-slate-900 dark:text-white">Status checks:</strong> the data on
            this site comes from providers&apos; public status pages and our own automated tests —
            none of it is about you.
          </p>
          <p>
            <strong className="text-slate-900 dark:text-white">&ldquo;It&apos;s broken for me too&rdquo; reports:</strong>{' '}
            anonymous. We store the app, the kind of issue, a coarse region, and hashed technical
            identifiers used only to filter spam and duplicates. IP addresses are used transiently
            for abuse prevention and stored only as a masked prefix.
          </p>
          <p>
            <strong className="text-slate-900 dark:text-white">Email alerts:</strong> if you sign
            up, we store your address solely to send the alerts you asked for. Every email includes
            an unsubscribe link, and unsubscribing removes you.
          </p>
          <p>
            <strong className="text-slate-900 dark:text-white">We do not sell personal data.</strong>{' '}
            Ever.
          </p>
        </section>

        <section className="surface-card p-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Cookies and local storage
          </h2>
          <p>
            Essential browser storage powers core features such as your dark-mode preference.
          </p>
          <p>
            Optional analytics (Google Analytics) runs only if you accept it in the cookie banner —
            it helps us understand which status pages help people most. If you reject it, no
            analytics events are sent from your browser.
          </p>
          <p>
            You can change your choice any time via the <strong>Cookie preferences</strong> link in
            the footer.
          </p>
          <p>
            Contact: <a className="underline" href="mailto:hello@aistatusdashboard.com">hello@aistatusdashboard.com</a>
          </p>
        </section>
      </div>
    </main>
  );
}
