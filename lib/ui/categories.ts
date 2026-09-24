// Shared category taxonomy for the "most reliable AI <category>" pages and for
// internal linking (app pages -> their category + a rival, so the /best and
// /compare pages aren't orphaned).
export const CATEGORIES: Record<string, { label: string; noun: string; appIds: string[] }> = {
  'ai-chatbot': {
    label: 'AI chatbot',
    noun: 'AI chatbots',
    appIds: ['chatgpt', 'claude', 'gemini', 'grok', 'perplexity', 'deepseek', 'meta-ai', 'le-chat', 'poe', 'kimi', 'character-ai'],
  },
  'ai-coding-assistant': {
    label: 'AI coding assistant',
    noun: 'AI coding assistants',
    appIds: ['copilot', 'cursor', 'windsurf', 'v0', 'lovable'],
  },
  'ai-image-generator': {
    label: 'AI image generator',
    noun: 'AI image generators',
    appIds: ['midjourney', 'ideogram', 'canva-ai'],
  },
  'ai-video-generator': {
    label: 'AI video generator',
    noun: 'AI video generators',
    appIds: ['sora', 'runway', 'minimax'],
  },
  'ai-voice-generator': {
    label: 'AI voice generator',
    noun: 'AI voice tools',
    appIds: ['elevenlabs', 'minimax'],
  },
};

export function categoryForApp(appId: string): { slug: string; label: string; noun: string; appIds: string[] } | null {
  for (const [slug, cat] of Object.entries(CATEGORIES)) {
    if (cat.appIds.includes(appId)) return { slug, ...cat };
  }
  return null;
}

// A sensible head-to-head rival for an app: the best-known other member of its
// category (config order), or a strong default.
export function rivalFor(appId: string): string | null {
  const cat = categoryForApp(appId);
  if (!cat) return null;
  const others = cat.appIds.filter((id) => id !== appId);
  return others[0] || null;
}

// Canonical a-vs-b ordering by category config order, matching the compare page.
export function comparePath(a: string, b: string): string {
  return `/compare/${a}-vs-${b}`;
}
