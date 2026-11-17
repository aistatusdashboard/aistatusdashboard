import type { StripDay, StripLevel } from '@/lib/services/status-strip';

const COLOR: Record<StripLevel, string> = {
  up: 'bg-emerald-500',
  wobbly: 'bg-amber-500',
  down: 'bg-rose-500',
  unknown: 'bg-slate-200 dark:bg-slate-700',
  nodata: 'bg-slate-200 dark:bg-slate-700',
};

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} h`;
}

function describe(day: StripDay): string {
  const when = new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  if (day.level === 'nodata' || day.level === 'unknown') return `${when}: no reading`;
  if (day.level === 'up') return `${when}: no issues`;
  const parts: string[] = [];
  if (day.downMinutes) parts.push(`down about ${duration(day.downMinutes)}`);
  if (day.wobblyMinutes) parts.push(`issues about ${duration(day.wobblyMinutes)}`);
  return `${when}: ${parts.join(', ')}`;
}

// One bar per day for the last 30 days, coloured by the worst status the
// provider itself reported that day. Server-rendered, no client script.
export default function StatusStrip({ days, name, provider }: { days: StripDay[]; name: string; provider: string }) {
  const read = days.filter((d) => d.level === 'up' || d.level === 'wobbly' || d.level === 'down');
  if (!read.length) return null;
  const troubled = read.filter((d) => d.level !== 'up').length;
  const summary =
    troubled === 0
      ? `No issues reported on any of the last ${read.length} days we have readings for.`
      : `Issues reported on ${troubled} of the last ${read.length} days we have readings for.`;

  return (
    <section className="surface-card-strong p-6 space-y-3" aria-label={`${name} status, last 30 days`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Last 30 days</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">{summary}</p>
      </div>
      <ol className="flex items-stretch gap-[3px] h-9" role="list">
        {days.map((day) => (
          <li key={day.date} className={`flex-1 rounded-sm ${COLOR[day.level]}`} title={describe(day)}>
            <span className="sr-only">{describe(day)}</span>
          </li>
        ))}
      </ol>
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500" />No issues</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-500" />Having issues</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-500" />Down</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-slate-200 dark:bg-slate-700" />No reading</span>
        <span>Each bar is one day of {provider}&apos;s own reported status, read every 5 minutes.</span>
      </p>
    </section>
  );
}
