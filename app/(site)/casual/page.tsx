import type { Metadata } from 'next';
import Link from 'next/link';
import { listCasualApps } from '@/lib/services/casual';
import CasualSearch from './ui/CasualSearch';

export const metadata: Metadata = {
  title: 'Casual Mode - AI Status Dashboard',
  description: 'Plain-English status for AI apps: what is happening, what you will feel, and what to do now.',
  alternates: { canonical: '/casual' },
};

export default function CasualHubPage() {
  const apps = listCasualApps();
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Casual Mode</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white mt-2">
              Plain-English AI status
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Get a human answer in seconds: what is happening, what you may feel, and what to do right now.
            </p>
          </header>

          <CasualSearch apps={apps} />

          <section className="grid gap-4 md:grid-cols-2">
            {apps.map((app) => (
              <Link key={app.id} href={`/casual/${app.id}`} className="surface-card p-5 hover:shadow-sm transition">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{app.label}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Status for {app.label.replace(' Status', '')} across text, images, login, and more.
                </p>
                <span className="text-xs text-slate-500 mt-3 inline-block">View status</span>
              </Link>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
