import { getChangelogEntries } from '@/lib/services/changelog';
import { formatDateLabel } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Changelog',
};

export default async function ChangelogPage() {
  const changelog = await getChangelogEntries(20);
  const generatedAt = changelog.generated_at ? formatDateLabel(changelog.generated_at) : null;

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10 max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Changelog</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Release notes and feature updates from the AI Status Dashboard team.
          </p>
          {generatedAt && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Generated at: {generatedAt}</p>
          )}
        </div>

        <section className="surface-card p-6">
          {changelog.entries.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No updates logged yet. Check back soon.
            </p>
          ) : (
            <ul className="space-y-4">
              {changelog.entries.map((entry) => (
                <li key={`${entry.date}-${entry.title}`} id={entry.date.replace(/[^0-9-]/g, '')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {entry.title}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{entry.date}</p>
                      {entry.summary ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">{entry.summary}</p>
                      ) : null}
                    </div>
                    {entry.link && (
                      <a
                        href={entry.link}
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      >
                        View →
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
