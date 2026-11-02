import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BLOG_POSTS, getPost } from '@/lib/blog/posts';
import { OG_BASE } from '@/lib/ui/metadata';
import MostReliableAi from '../_posts/most-reliable-ai';

export const revalidate = 1800;

// Slug -> body component. Each post is a server component that can read live data.
const BODIES: Record<string, () => Promise<React.ReactElement> | React.ReactElement> = {
  'most-reliable-ai': MostReliableAi,
};

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

type Params = { slug: string } | Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await Promise.resolve(params);
  const post = getPost(slug);
  if (!post) return {};
  const url = `https://aistatusdashboard.com/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { ...OG_BASE, title: post.title, description: post.description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
  };
}

export default async function BlogPost({ params }: { params: Params }) {
  const { slug } = await Promise.resolve(params);
  const post = getPost(slug);
  const Body = BODIES[slug];
  if (!post || !Body) notFound();

  const url = `https://aistatusdashboard.com/blog/${post.slug}`;
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'AI Status' },
    publisher: { '@type': 'Organization', name: 'AI Status' },
  };

  return (
    <main className="flex-1 px-4 sm:px-6 py-10">
      <article className="max-w-3xl mx-auto space-y-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
        <header className="pt-4 space-y-3">
          <Link href="/blog" className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
            ← Blog
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium dark:bg-slate-800">{post.tag}</span>
            {post.live && <span className="text-emerald-600 dark:text-emerald-400">● Updated continuously</span>}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{post.title}</h1>
        </header>
        <Body />
      </article>
    </main>
  );
}
