import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCasualApp, getCasualStatus, listCasualApps } from '@/lib/services/casual';
import { getAppReliability } from '@/lib/services/reliability';
import { shortName, verdictKey, VERDICT_COPY } from '@/lib/ui/verdict';

export const revalidate = 300;
export const dynamicParams = true;

type PairParams = { pair: string };

// Popular head-to-heads get prerendered; any valid a-vs-b still renders on demand.
const POPULAR = [
  'chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'deepseek', 'copilot', 'cursor',
];

export function generateStaticParams() {
  const pairs: { pair: string }[] = [];
  for (let i = 0; i < POPULAR.length; i++) {
    for (let j = i + 1; j < POPULAR.length; j++) {
      pairs.push({ pair: `${POPULAR[i]}-vs-${POPULAR[j]}` });
    }
  }
  return pairs;
}

function parsePair(pair: string): [string, string] | null {
  const m = /^(.+?)-vs-(.+)$/.exec(pair.toLowerCase());
  if (!m) return null;
  return [m[1], m[2]];
}

// One canonical order per pair (config order) so a-vs-b and b-vs-a don't
// compete as duplicate content.
function canonicalOrder(aId: string, bId: string): [string, string] {
  const order = listCasualApps().map((a) => a.id);
  return order.indexOf(aId) <= order.indexOf(bId) ? [aId, bId] : [bId, aId];
}

export async function generateMetadata({ params }: { params: Promise<PairParams> }): Promise<Metadata> {
  const { pair } = await params;
  const parsed = parsePair(pair);
  if (!parsed) return { title: 'Compare AI apps' };
  const a = getCasualApp(parsed[0]);
  const b = getCasualApp(parsed[1]);
  if (!a || !b) return { title: 'Compare AI apps' };
  const [x, y] = canonicalOrder(a.id, b.id);
  const nx = shortName(x, getCasualApp(x)!.label);
  const ny = shortName(y, getCasualApp(y)!.label);
  const title = `${nx} vs ${ny}: status, uptime & reliability`;
  const description = `${nx} vs ${ny} compared right now — live status, 30-day uptime, and outage history for both, side by side. Which AI is more reliable?`;
  return {
    title,
    description,
    alternates: { canonical: `/compare/${x}-vs-${y}` },
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ComparePage({ params }: { params: Promise<PairParams> }) {
  const { pair } = await params;
  const parsed = parsePair(pair);
  if (!parsed) return notFound();
  const aApp = getCasualApp(parsed[0]);
  const bApp = getCasualApp(parsed[1]);
  if (!aApp || !bApp || aApp.id === bApp.id) return notFound();
  const [xId, yId] = canonicalOrder(aApp.id, bApp.id);
  const x = getCasualApp(xId)!;
  const y = getCasualApp(yId)!;

  const [xStatus, yStatus, xRel, yRel] = await Promise.all([
    getCasualStatus({ appId: x.id }).catch(() => null),
    getCasualStatus({ appId: y.id }).catch(() => null),
    getAppReliability(x.providerId).catch(() => null),
    getAppReliability(y.providerId).catch(() => null),
  ]);

  const nx = shortName(x.id, x.label);
  const ny = shortName(y.id, y.label);
  const xKey = xStatus ? verdictKey(xStatus.overall_status) : 'unknown';
  const yKey = yStatus ? verdictKey(yStatus.overall_status) : 'unknown';

  // Which is more reliable over 30 days (by weighted uptime, then fewer incidents).
  let winner: string | null = null;
  if (xRel && yRel) {
    if (Math.abs(xRel.uptimePct - yRel.uptimePct) > 0.05) {
      winner = xRel.uptimePct > yRel.uptimePct ? nx : ny;
    } else {
      winner = xRel.incidentCount <= yRel.incidentCount ? nx : ny;
    }
  }

  const verdictSentence = winner
    ? `Over the last 30 days, ${winner} has been the more reliable of the two.`
    : `We are still building enough history to compare the two.`;

  const faqs = [
    {
      q: `Is ${nx} or ${ny} more reliable?`,
      a: xRel && yRel
        ? `${verdictSentence} ${nx}: ${xRel.uptimePct.toFixed(2)}% uptime, ${xRel.incidentCount} incidents in 30 days. ${ny}: ${yRel.uptimePct.toFixed(2)}% uptime, ${yRel.incidentCount} incidents.`
        : verdictSentence,
    },
    {
      q: `Is ${nx} down right now?`,
      a: xStatus ? `${VERDICT_COPY[xKey].sentence(nx)} ${xStatus.headline}` : `We can't read ${nx}'s status right now.`,
    },
    {
      q: `Is ${ny} down right now?`,
      a: yStatus ? `${VERDICT_COPY[yKey].sentence(ny)} ${yStatus.headline}` : `We can't read ${ny}'s status right now.`,
    },
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  const renderCol = (app: typeof x, name: string, k: string, rel: typeof xRel) => (
    <div className="surface-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Link href={`/${app.id}`} className="text-lg font-semibold text-slate-900 dark:text-white hover:underline">{name}</Link>
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{VERDICT_COPY[k as 'up']?.label || 'Unknown'}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-slate-500 dark:text-slate-400">30-day uptime</dt><dd className="text-xl font-bold text-slate-900 dark:text-white">{rel ? `${rel.uptimePct.toFixed(2)}%` : '—'}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Incidents (30d)</dt><dd className="text-xl font-bold text-slate-900 dark:text-white">{rel ? rel.incidentCount : '—'}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Reliability rank</dt><dd className="text-xl font-bold text-slate-900 dark:text-white">{rel?.rank ? `#${rel.rank} of ${rel.total}` : '—'}</dd></div>
        <div><dt className="text-slate-500 dark:text-slate-400">Longest outage</dt><dd className="text-xl font-bold text-slate-900 dark:text-white">{rel && rel.longestIncidentMinutes > 0 ? `${rel.longestIncidentMinutes}m` : '—'}</dd></div>
      </dl>
      <Link href={`/${app.id}`} className="inline-block text-sm underline text-slate-700 dark:text-slate-200">Is {name} down right now? →</Link>
    </div>
  );

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{nx} vs {ny}: which is more reliable?</h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            {nx} and {ny} compared right now — live status and 30-day uptime for both, from each provider&apos;s own official incident feed. {verdictSentence}
          </p>
        </header>
        <section className="grid gap-4 sm:grid-cols-2">
          {renderCol(x, nx, xKey, xRel)}
          {renderCol(y, ny, yKey, yRel)}
        </section>
        <section className="surface-card p-5 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Questions</h2>
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
