import type { Metadata } from 'next';
import Link from 'next/link';
import { listCasualApps } from '@/lib/services/casual';
import { shortName } from '@/lib/ui/verdict';
import CopyField from '@/app/components/CopyField';

export const revalidate = 3600;

const SITE = 'https://aistatusdashboard.com';
const description =
  'Add a free, always-live "is it down?" status badge for ChatGPT, Claude, Gemini or any AI app to your site, README or docs. Copy one line. Updates automatically.';

export const metadata: Metadata = {
  title: 'AI status badges — embed a live "is it down?" badge',
  description,
  alternates: { canonical: '/embed' },
  openGraph: { title: 'Embed a live AI status badge', description },
  twitter: { title: 'Embed a live AI status badge', description },
};

// The apps most likely to be embedded in a README / docs / blog. The badge works
// for every app on the board, but a curated set keeps the page useful.
const FEATURED = [
  'chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'deepseek',
  'cursor', 'copilot', 'codex', 'midjourney', 'sora', 'dots',
];

function snippets(id: string, name: string) {
  const badge = `${SITE}/badge/${id}.svg`;
  const page = `${SITE}/${id}`;
  return {
    markdown: `[![${name} status](${badge})](${page})`,
    html: `<a href="${page}"><img src="${badge}" alt="${name} status"></a>`,
  };
}

export default function EmbedPage() {
  const apps = listCasualApps();
  const byId = new Map(apps.map((a) => [a.id, a]));
  const featured = FEATURED.map((id) => byId.get(id)).filter(Boolean) as typeof apps;

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-10">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            AI status badges
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl">
            Drop a live “is it down?” badge for any AI app into your README, docs, status page or
            blog. It mirrors each provider’s official status and updates on its own — paste one line,
            done. Free, no account.
          </p>
        </header>

        <section className="space-y-6">
          {featured.map((app) => {
            const name = shortName(app.id, app.label);
            const { markdown, html } = snippets(app.id, name);
            return (
              <div
                key={app.id}
                className="rounded-xl border border-slate-200 p-4 space-y-3 dark:border-slate-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/badge/${app.id}.svg`}
                      alt={`${name} status badge`}
                      height={20}
                      className="h-5"
                    />
                  </div>
                  <Link
                    href={`/${app.id}`}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    {name} page →
                  </Link>
                </div>
                <CopyField value={markdown} label="Markdown" />
                <CopyField value={html} label="HTML" />
              </div>
            );
          })}
        </section>

        <section className="space-y-3 rounded-xl bg-slate-50 p-5 dark:bg-slate-900/50">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Any other app</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Swap in any app’s id — the badge exists for every app on the board:
          </p>
          <CopyField
            value={`[![AI status](${SITE}/badge/your-app.svg)](${SITE}/your-app)`}
            label="Markdown"
          />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            See the full list on the{' '}
            <Link href="/" className="underline">
              home board
            </Link>
            . The badge shows <span className="font-medium text-emerald-600 dark:text-emerald-400">operational</span>,{' '}
            <span className="font-medium text-amber-600 dark:text-amber-400">issues</span>, or{' '}
            <span className="font-medium text-rose-600 dark:text-rose-400">down</span>, refreshed every few minutes.
          </p>
        </section>
      </div>
    </main>
  );
}
