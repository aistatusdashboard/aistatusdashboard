import type { Metadata } from 'next';
import Link from 'next/link';
import { BLOG_POSTS } from '@/lib/blog/posts';
import { OG_BASE } from '@/lib/ui/metadata';

export const revalidate = 3600;

const description =
  'Data-driven writing on AI reliability and outages — uptime rankings, outage post-mortems and what the numbers say, from the AI Status Dashboard.';

export const metadata: Metadata = {
  title: 'AI reliability & outages — the blog',
  description,
  alternates: { canonical: '/blog' },
  openGraph: { ...OG_BASE, title: 'AI reliability & outages — the blog', description, url: 'https://aistatusdashboard.com/blog', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'AI reliability & outages — the blog', description },
};

export default function BlogIndex() {
  const posts = [...BLOG_POSTS].sort((a, b) => b.published.localeCompare(a.published));
  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="pt-4 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Blog</h1>
          <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl">
            What the data says about AI reliability and outages — built from the same live feeds behind
            the dashboard. No filler.
          </p>
        </header>

        <div className="space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block rounded-xl border border-slate-200 p-5 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-900/50"
            >
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium dark:bg-slate-800">{post.tag}</span>
                {post.live && <span className="text-emerald-600 dark:text-emerald-400">● Live data</span>}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{post.title}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{post.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
