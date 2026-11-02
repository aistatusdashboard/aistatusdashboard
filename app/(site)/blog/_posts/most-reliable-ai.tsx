import Image from 'next/image';
import Link from 'next/link';
import { getReliabilityRanking } from '@/lib/services/reliability';
import { APP_LOGOS } from '@/lib/ui/verdict';

function uptimeTone(pct: number): string {
  if (pct >= 99.9) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 99.0) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function Row({
  rank,
  appId,
  name,
  uptimePct,
  incidentCount,
}: {
  rank: number;
  appId: string;
  name: string;
  uptimePct: number;
  incidentCount: number;
}) {
  return (
    <Link
      href={`/${appId}`}
      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/50"
    >
      <span className="w-6 shrink-0 text-sm tabular-nums text-slate-400">{rank}</span>
      <Image src={APP_LOGOS[appId] || '/logos/openai.svg'} alt="" width={20} height={20} className="h-5 w-5 rounded" />
      <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{name}</span>
      <span className={`text-sm font-semibold tabular-nums ${uptimeTone(uptimePct)}`}>{uptimePct.toFixed(2)}%</span>
      <span className="w-20 shrink-0 text-right text-xs text-slate-400">
        {incidentCount} incident{incidentCount === 1 ? '' : 's'}
      </span>
    </Link>
  );
}

// Dynamic post body: every number is read live from the 30-day reliability
// ranking, so the piece is accurate whenever it's viewed — no stale figures.
export default async function MostReliableAi() {
  const rows = await getReliabilityRanking();
  const rated = rows.filter((r) => r.incidentCount > 0);
  const best = rated[0] || null;
  const worst = rated.length ? rated[rated.length - 1] : null;
  const clean = rows.length - rated.length;
  const top = rated.slice(0, 10);
  const bottom = rated.slice(-5).reverse();

  return (
    <div className="space-y-8">
      <p className="text-base text-slate-700 dark:text-slate-300">
        We read the official status page behind every AI app on the dashboard every few minutes and
        record every incident each provider reports. This is what that data says about reliability
        over the last 30 days — ranked by uptime, straight from the source. The numbers below are{' '}
        <span className="font-medium">live</span>: they reflect the latest window every time you load
        the page.
      </p>

      {best && worst && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Most reliable (with incidents on record)
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{best.name}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {best.uptimePct.toFixed(2)}% uptime · {best.incidentCount} incident
              {best.incidentCount === 1 ? '' : 's'} in 30 days
            </div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
            <div className="text-xs uppercase tracking-wide text-rose-700 dark:text-rose-400">
              Most troubled
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{worst.name}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {worst.uptimePct.toFixed(2)}% uptime · {worst.incidentCount} incident
              {worst.incidentCount === 1 ? '' : 's'} in 30 days
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-600 dark:text-slate-300">
        {clean > 0 && (
          <>
            {clean} of the {rows.length} providers ranked here reported <span className="font-medium">zero</span>{' '}
            incidents in the window. A clean sheet isn&apos;t automatically a win — some feeds are newer
            or quieter than others — so the ranking below only crowns apps that have a track record to
            judge.
          </>
        )}
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Most reliable right now</h2>
        <div className="rounded-xl border border-slate-200 p-1.5 dark:border-slate-800">
          {top.map((r, i) => (
            <Row key={r.appId} rank={i + 1} {...r} />
          ))}
        </div>
      </section>

      {bottom.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Most incidents right now</h2>
          <div className="rounded-xl border border-slate-200 p-1.5 dark:border-slate-800">
            {bottom.map((r, i) => (
              <Row key={r.appId} rank={rated.length - i} {...r} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2 rounded-xl bg-slate-50 p-5 text-sm text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">How we measure it</h2>
        <p>
          Uptime is derived from the incidents each provider publishes on its own official status page
          over a rolling 30-day window — not from our own guesses or pings. A provider that posts many
          small, honest incidents can rank below a quieter one; we weight for that, and the full
          method is on the{' '}
          <Link href="/how-it-works" className="underline">
            how it works
          </Link>{' '}
          page. See the complete, always-current table on{' '}
          <Link href="/reliability" className="underline">
            the reliability ranking
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
