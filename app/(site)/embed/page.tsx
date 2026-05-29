import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Embed Status Widget',
  description:
    'Embed ChatGPT, Claude, Gemini, and provider status badges as JS, SVG, or JSON.',
  alternates: { canonical: '/embed' },
};

export default function EmbedPage() {
  const scriptSnippet =
    '<script src="https://aistatusdashboard.com/embed/chatgpt.js" data-size="small" data-theme="auto"></script>';
  const svgSnippet = '![ChatGPT status](https://aistatusdashboard.com/embed/chatgpt.svg)';
  const jsonSnippet = 'curl https://aistatusdashboard.com/embed/chatgpt.json';

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="surface-card-strong p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Embed</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">
            Status embeds for your site
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            Publish a compact status badge and link readers to the matching Casual Mode page.
          </p>
        </header>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">JavaScript</h2>
          <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 overflow-x-auto text-xs">{scriptSnippet}</pre>
          <div className="border rounded-xl border-slate-200/70 dark:border-slate-700/70 p-4">
            <script
              src="https://aistatusdashboard.com/embed/chatgpt.js"
              data-size="small"
              data-theme="auto"
            />
          </div>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">SVG badge</h2>
          <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 overflow-x-auto text-xs">{svgSnippet}</pre>
          <img
            src="https://aistatusdashboard.com/embed/chatgpt.svg"
            alt="ChatGPT embed status"
            className="h-8 w-auto"
          />
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">JSON payload</h2>
          <pre className="rounded-xl bg-slate-900 text-slate-100 p-4 overflow-x-auto text-xs">{jsonSnippet}</pre>
        </section>

        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Use cases</h2>
          <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <li>Show service health in your product status page.</li>
            <li>Add a live badge to a GitHub README.</li>
            <li>Feed a Slack bot from the JSON endpoint.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
