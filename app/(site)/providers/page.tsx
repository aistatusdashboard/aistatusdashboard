import type { Metadata } from 'next';
import { providerService } from '@/lib/services/providers';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Providers',
  description: 'Provider list snapshot for crawlers and users.',
  alternates: {
    canonical: '/providers',
    types: {
      'application/rss+xml': `${SITE_URL}/rss.xml`,
    },
  },
};

export default function ProvidersPage() {
  const providers = providerService.getProviders();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: providers.map((p, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `https://aistatusdashboard.com/provider/${p.id}`,
      name: p.displayName || p.name,
    })),
  };
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10 max-w-5xl mx-auto space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Providers</h1>
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300">
          {providers.map((p) => (
            <li key={p.id}>
              <a href={`/provider/${p.id}`}>{p.displayName || p.name}</a> — {p.statusPageUrl || 'status page'}
            </li>
          ))}
        </ul>
        <noscript>
          <div className="surface-card p-4">
            <p>Noscript snapshot: use /api/public/v1/providers for JSON.</p>
          </div>
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </div>
    </main>
  );
}
