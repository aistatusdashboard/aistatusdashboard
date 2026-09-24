import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getReliabilityRankingCached } from '@/lib/services/reliability';
import { listCasualApps } from '@/lib/services/casual';
import { CATEGORIES } from '@/lib/ui/categories';

export const revalidate = 1800;
export const dynamicParams = false;

type CategoryParams = { category: string };

export function generateStaticParams() {
  return Object.keys(CATEGORIES).map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<CategoryParams> }): Promise<Metadata> {
  const { category } = await params;
  const cat = CATEGORIES[category];
  if (!cat) return { title: 'Most reliable AI' };
  const title = `Most reliable ${cat.label}: ${cat.noun} ranked by uptime`;
  const description = `Which ${cat.label} is the most reliable? ${cat.noun} ranked by 30-day uptime and outage history, from each provider's own official incident feed.`;
  return { title, description, alternates: { canonical: `/best/${category}` }, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
}

export default async function BestCategoryPage({ params }: { params: Promise<CategoryParams> }) {
  const { category } = await params;
  const cat = CATEGORIES[category];
  if (!cat) return notFound();

  const [ranking, apps] = await Promise.all([getReliabilityRankingCached().catch(() => []), Promise.resolve(listCasualApps())]);
  const appById = new Map(apps.map((a) => [a.id, a]));
  const providerOf = new Map(apps.map((a) => [a.id, a.providerId]));
  const inCategory = cat.appIds
    .map((id) => {
      const providerId = providerOf.get(id);
      const row = ranking.find((r) => r.providerId === providerId);
      const app = appById.get(id);
      if (!row || !app) return null;
      return { id, name: app.label.replace(/\s+Status$/i, ''), uptimePct: row.uptimePct, incidentCount: row.incidentCount, longest: row.longestIncidentMinutes };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.uptimePct - a.uptimePct || a.incidentCount - b.incidentCount);

  if (!inCategory.length) return notFound();
  const best = inCategory[0];

  const faqs = [
    {
      q: `Which ${cat.label} is the most reliable?`,
      a: `Over the last 30 days, ${best.name} has been the most reliable ${cat.label} we track, at ${best.uptimePct.toFixed(2)}% uptime across ${best.incidentCount} incident${best.incidentCount === 1 ? '' : 's'}. Rankings come from each provider's own official incident history.`,
    },
    {
      q: `How is ${cat.label} reliability measured?`,
      a: `We read each provider's official status page every five minutes and total the time each service reported problems over the last 30 days, weighted by severity, to compute uptime.`,
    },
  ];
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Most reliable ${cat.noun} by uptime`,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      itemListElement: inCategory.map((a, i) => ({ '@type': 'ListItem', position: i + 1, name: `${a.name} — ${a.uptimePct.toFixed(2)}% uptime`, url: `https://aistatusdashboard.com/${a.id}` })),
    },
  ];

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Most reliable {cat.label}</h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            {cat.noun} ranked by 30-day uptime, from each provider&apos;s own official incident feed. Over the last 30 days, the most reliable has been <strong className="text-slate-900 dark:text-white">{best.name}</strong> ({best.uptimePct.toFixed(2)}% uptime).
          </p>
        </header>
        <section className="surface-card divide-y divide-slate-200/70 dark:divide-slate-800/70">
          {inCategory.map((a, i) => (
            <div key={a.id} className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <span className="font-mono text-sm text-slate-400 dark:text-slate-500 w-6">{i + 1}</span>
                <Link href={`/${a.id}`} className="font-semibold text-slate-900 dark:text-white hover:underline truncate">{a.name}</Link>
              </div>
              <div className="flex items-center gap-6 text-sm shrink-0">
                <span className="font-bold text-slate-900 dark:text-white">{a.uptimePct.toFixed(2)}%</span>
                <span className="text-slate-500 dark:text-slate-400">{a.incidentCount} incident{a.incidentCount === 1 ? '' : 's'}</span>
              </div>
            </div>
          ))}
        </section>
        <section className="surface-card p-5 space-y-3">
          {faqs.map((f) => (
            <div key={f.q}>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{f.q}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{f.a}</p>
            </div>
          ))}
        </section>
        <p className="flex flex-wrap gap-4 text-sm">
          <Link href="/reliability" className="underline text-slate-700 dark:text-slate-200">Full AI reliability ranking →</Link>
          <Link href="/" className="underline text-slate-700 dark:text-slate-200">Live status of every AI →</Link>
        </p>
      </div>
    </main>
  );
}
