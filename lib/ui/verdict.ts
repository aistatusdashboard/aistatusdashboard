export type VerdictKey = 'up' | 'wobbly' | 'down' | 'unknown';

export function verdictKey(status: string): VerdictKey {
  switch (status) {
    case 'down':
    case 'major_outage':
      return 'down';
    case 'degraded':
    case 'partial_outage':
    case 'maintenance':
      return 'wobbly';
    case 'unknown':
      return 'unknown';
    default:
      return 'up';
  }
}

export const VERDICT_ORDER: Record<VerdictKey, number> = {
  down: 0,
  wobbly: 1,
  unknown: 2,
  up: 3,
};

// One voice everywhere: short, human, no jargon.
export const VERDICT_COPY: Record<
  VerdictKey,
  { word: string; sentence: (name: string) => string; label: string }
> = {
  up: {
    word: 'Up',
    sentence: (name) => `${name} is up.`,
    label: 'Up',
  },
  wobbly: {
    word: 'Having issues',
    sentence: (name) => `${name} is having issues.`,
    label: 'Having issues',
  },
  down: {
    word: 'Down',
    sentence: (name) => `${name} looks down.`,
    label: 'Down',
  },
  unknown: {
    word: 'Checking',
    sentence: (name) => `We can't verify ${name} right now.`,
    label: 'Checking',
  },
};

export const VERDICT_TONE: Record<
  VerdictKey,
  { dot: string; text: string; card: string; badge: string }
> = {
  up: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    card: 'border-slate-200/70 dark:border-slate-700/60',
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  },
  wobbly: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    card: 'border-amber-300/80 dark:border-amber-700/60 shadow-[0_0_0_3px_rgba(245,158,11,0.08)]',
    badge:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  },
  down: {
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    card: 'border-rose-300/80 dark:border-rose-700/60 shadow-[0_0_0_3px_rgba(244,63,94,0.10)]',
    badge:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  },
  unknown: {
    dot: 'bg-slate-400',
    text: 'text-slate-500 dark:text-slate-400',
    card: 'border-slate-200/70 dark:border-slate-700/60 border-dashed',
    badge:
      'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700',
  },
};

export function shortName(appId: string, label: string): string {
  const names: Record<string, string> = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    grok: 'Grok',
    perplexity: 'Perplexity',
    deepseek: 'DeepSeek',
    'meta-ai': 'Meta AI',
    copilot: 'GitHub Copilot',
    cursor: 'Cursor',
    'character-ai': 'Character.AI',
    'le-chat': 'Le Chat',
  };
  return names[appId] || label.replace(' Status', '');
}

export const APP_LOGOS: Record<string, string> = {
  chatgpt: '/logos/openai-chatgpt.png',
  claude: '/logos/claude.svg',
  gemini: '/logos/google-ai.svg',
  grok: '/logos/xai.svg',
  perplexity: '/logos/perplexity.svg',
  deepseek: '/logos/deepseek.svg',
  'meta-ai': '/logos/meta.svg',
  copilot: '/logos/copilot.svg',
  cursor: '/logos/cursor.svg',
  'character-ai': '/logos/character-ai.svg',
  'le-chat': '/logos/mistral.svg',
};
