'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { APP_LOGOS, VERDICT_TONE, VERDICT_COPY, type VerdictKey } from '@/lib/ui/verdict';

export type BoardItem = {
  id: string;
  name: string;
  key: VerdictKey;
  noPage: boolean;
  category: { slug: string; label: string } | null;
};

type StatusFilter = 'all' | 'issues' | 'up';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'issues', label: 'Having issues' },
  { id: 'up', label: 'Operational' },
];

// Default order is decided on the server (status severity first — anything down
// floats to the top — then popularity). This component only filters and offers an
// A–Z alternative; it never changes the default "what's broken now" ordering.
export default function StatusBoard({
  items,
  categories,
}: {
  items: BoardItem[];
  categories: { slug: string; label: string }[];
}) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [cat, setCat] = useState<string>('all');
  const [sort, setSort] = useState<'smart' | 'az'>('smart');

  const shown = useMemo(() => {
    let rows = items.filter((it) => {
      if (status === 'issues' && !(it.key === 'down' || it.key === 'wobbly')) return false;
      if (status === 'up' && it.key !== 'up') return false;
      if (cat !== 'all' && it.category?.slug !== cat) return false;
      return true;
    });
    if (sort === 'az') rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [items, status, cat, sort]);

  const issuesCount = items.filter((it) => it.key === 'down' || it.key === 'wobbly').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
        <span className="flex gap-1.5" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setStatus(f.id)} className={chip(status === f.id)}>
              {f.label}
              {f.id === 'issues' && issuesCount > 0 ? ` (${issuesCount})` : ''}
            </button>
          ))}
        </span>
        <span className="h-4 w-px bg-slate-300/60 dark:bg-slate-700/60" aria-hidden="true" />
        <span className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
          <button type="button" onClick={() => setCat('all')} className={chip(cat === 'all')}>
            All types
          </button>
          {categories.map((c) => (
            <button key={c.slug} type="button" onClick={() => setCat(c.slug)} className={chip(cat === c.slug)}>
              {c.label}
            </button>
          ))}
        </span>
        <button
          type="button"
          onClick={() => setSort((s) => (s === 'smart' ? 'az' : 'smart'))}
          className={`${chip(false)} ml-auto`}
          aria-label="Change sort order"
        >
          {sort === 'smart' ? 'Sort: Smart' : 'Sort: A–Z'}
        </button>
      </div>

      <section aria-label="AI app status board" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((it) => {
          const tone = VERDICT_TONE[it.key];
          const label = it.noPage ? 'No status page' : VERDICT_COPY[it.key].label;
          return (
            <Link
              key={it.id}
              href={`/${it.id}`}
              className={`group rounded-2xl border bg-white/80 dark:bg-slate-900/70 p-4 flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-lg ${tone.card}`}
            >
              <Image
                src={APP_LOGOS[it.id] || '/logos/openai.svg'}
                alt=""
                width={36}
                height={36}
                className="rounded-lg shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-slate-900 dark:text-white truncate">{it.name}</span>
                <span className={`block text-sm font-medium ${tone.text}`}>{label}</span>
              </span>
              <span
                className={`h-2.5 w-2.5 rounded-full shrink-0 ${tone.dot} ${it.key !== 'up' ? 'animate-pulse' : ''}`}
                aria-hidden="true"
              />
            </Link>
          );
        })}
        {shown.length === 0 && (
          <p className="col-span-full text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            No apps match this filter.
          </p>
        )}
      </section>
    </div>
  );
}

function chip(active: boolean): string {
  return `px-2.5 py-1 rounded-full border transition ${
    active
      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
      : 'border-slate-300/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 hover:border-slate-400'
  }`;
}
