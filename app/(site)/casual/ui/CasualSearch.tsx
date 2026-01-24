'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CasualAppConfig } from '@/lib/types/casual';
import surfacesConfig from '@/lib/casual/surfaces.json';

type CasualSearchProps = {
  apps: CasualAppConfig[];
};

const surfaces = surfacesConfig.surfaces as Record<string, { label: string }>;

export default function CasualSearch({ apps }: CasualSearchProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return { apps, surfaces: [] as string[] };

    const matchedApps = apps.filter((app) =>
      app.label.toLowerCase().includes(needle) || app.id.includes(needle)
    );
    const matchedSurfaces = Object.keys(surfaces).filter((key) =>
      surfaces[key].label.toLowerCase().includes(needle)
    );

    return { apps: matchedApps, surfaces: matchedSurfaces };
  }, [query, apps]);

  return (
    <section className="surface-card p-6 space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="casual-search">
          Status search
        </label>
        <input
          id="casual-search"
          className="mt-2 w-full rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/60 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Search ChatGPT, Claude, Images, Voice, Login"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {results.apps.map((app) => (
          <Link key={app.id} href={`/casual/${app.id}`} className="surface-card p-4 hover:shadow-sm transition">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{app.label}</p>
            <p className="text-xs text-slate-500">Quick answers for {app.providerDisplay} users.</p>
          </Link>
        ))}
      </div>

      {results.surfaces.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Popular surfaces</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {results.surfaces.map((surface) => (
              <span key={surface} className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
                {surfaces[surface].label}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
