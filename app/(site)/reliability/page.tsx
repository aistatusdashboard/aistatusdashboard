import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getReliabilityRanking } from '@/lib/services/reliability';
import { formatTimeAgo } from '@/lib/utils/time';
import { APP_LOGOS } from '@/lib/ui/verdict';

export const revalidate = 1800;

const description =
  'Which AI is the most reliable? A 30-day ranking of ChatGPT, Claude, Gemini, Midjourney, and 20+ other AI apps by uptime and incident history — from independent monitoring.';

export const metadata: Metadata = {
  title: 'Which AI is the most reliable?',
  description,
  alternates: { canonical: '/reliability' },
  openGraph: { title: 'Which AI is the most reliable? | AI Status', description },
  twitter: { title: 'Which AI is the most reliable? | AI Status', description },
};

function uptimeTone(pct: number): string {
  if (pct >= 99.9) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 99.0) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default async function ReliabilityPage() {
  const rows = await getReliabilityRanking();
  const best = rows[0];
  const withIncidents = rows.filter((row) => row.incidentCount > 0);
  const worst = withIncidents.length ? withIncidents[withIncidents.length - 1] : null;

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Which AI is the most reliable?
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            The last 30 days across every AI service we watch, ranked by measured uptime — computed
            from official incident feeds and our own independent checks, not marketing pages.
          </p>
          {best && worst && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Over the last 30 days, the most reliable was{' '}
              <strong className="text-slate-900 dark:text-white">{best.name}</strong> (
              {best.uptimePct.toFixed(2)}% uptime, {best.incidentCount} incident
              {best.incidentCount === 1 ? '' : 's'}); the most trouble-prone was{' '}
              <strong className="text-slate-900 dark:text-white">{worst.name}</strong> (
              {worst.uptimePct.toFixed(2)}%, {worst.incidentCount} incident
              {worst.incidentCount === 1 ? '' : 's'}).
            </p>
          )}
        </header>

        <section className="surface-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700/60">
                <th className="p-3 w-8">#</th>
                <th className="p-3">Service</th>
                <th className="p-3 text-right">Uptime (30d)</th>
                <th className="p-3 text-right">Incidents</th>
                <th className="p-3 text-right hidden sm:table-cell">Longest</th>
                <th className="p-3 text-right hidden sm:table-cell">Last incident</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.appId}
                  className="border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                >
                  <td className="p-3 font-mono text-xs text-slate-400">{index + 1}</td>
                  <td className="p-3">
                    <Link href={`/${row.appId}`} className="flex items-center gap-2.5 hover:underline">
                      <Image
                        src={APP_LOGOS[row.appId] || '/logos/openai.svg'}
                        alt=""
                        width={22}
                        height={22}
                        className="rounded-md shrink-0"
                      />
                      <span className="font-medium text-slate-900 dark:text-white">
                        {row.name}
                        {row.siblings.length > 0 && (
                          <span className="text-xs text-slate-400 font-normal"> +{row.siblings.join(', ')}</span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className={`p-3 text-right font-mono font-semibold ${uptimeTone(row.uptimePct)}`}>
                    {row.uptimePct.toFixed(2)}%
                  </td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-200">
                    {row.incidentCount}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                    {row.longestIncidentMinutes ? `${row.longestIncidentMinutes}m` : '—'}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                    {row.lastIncidentAt ? formatTimeAgo(row.lastIncidentAt) : 'none'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
          <p>
            <strong className="text-slate-700 dark:text-slate-300">Method:</strong> uptime is 100%
            minus the share of the last 30 days covered by incidents from each provider&apos;s
            official feed (a single incident is capped at 24h; never-resolved incidents count until
            their last update). Services sharing one status feed are ranked together.
          </p>
          <p>
            Recently added services can show fewer incidents simply because we started watching them
            later. Rankings refresh every 30 minutes. This is independent monitoring —{' '}
            <Link href="/how-it-works" className="underline">how it works</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
