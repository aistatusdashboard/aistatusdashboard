// Blog post registry. One entry per post — kept deliberately small (a handful of
// genuinely data-backed pieces, not a content farm). A post's body lives in
// app/(site)/blog/_posts/<slug>.tsx and is wired in the [slug] route.
export type BlogPostMeta = {
  slug: string;
  title: string;
  description: string;
  published: string; // ISO date first published
  live: boolean; // true = numbers update continuously from live data
  tag: string;
};

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: 'chatgpt-down-august-31-2026',
    title: 'What happened when ChatGPT went down on August 31, 2026',
    description:
      "A minute-by-minute post-mortem of ChatGPT's biggest outage of the season — 5+ hours of errors and downtime that hit ChatGPT Work hardest — rebuilt from OpenAI's own status updates.",
    published: '2026-09-02',
    live: false,
    tag: 'Post-mortem',
  },
  {
    slug: 'most-reliable-ai',
    title: 'The most (and least) reliable AI tools right now',
    description:
      "A live 30-day ranking of ChatGPT, Claude, Gemini and 40+ AI apps by real uptime and incident history — read straight from each provider's official status feed and updated continuously.",
    published: '2026-11-02',
    live: true,
    tag: 'Data',
  },
];

export function getPost(slug: string): BlogPostMeta | null {
  return BLOG_POSTS.find((p) => p.slug === slug) || null;
}
