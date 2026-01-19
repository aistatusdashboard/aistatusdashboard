'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type ProviderOption = {
  id: string;
  name: string;
  displayName?: string;
  aliases?: string[];
};

interface LandingSearchProps {
  providers: ProviderOption[];
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export default function LandingSearch({ providers }: LandingSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const index = useMemo(
    () =>
      providers.map((provider) => {
        const tokens = [
          provider.id,
          provider.name,
          provider.displayName,
          ...(provider.aliases || []),
        ].filter(Boolean) as string[];
        return { ...provider, tokens };
      }),
    [providers]
  );

  const resolveProvider = (value: string) => {
    const needle = normalize(value);
    if (!needle) return null;

    let best: { id: string; score: number } | null = null;
    index.forEach((provider) => {
      provider.tokens.forEach((token) => {
        const normalizedToken = normalize(token);
        if (!normalizedToken) return;
        let score = 0;
        if (normalizedToken === needle) score = 3;
        else if (normalizedToken.startsWith(needle)) score = 2;
        else if (normalizedToken.includes(needle)) score = 1;
        if (!best || score > best.score) {
          best = { id: provider.id, score };
        }
      });
    });
    return best;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      router.push('/dashboard');
      return;
    }

    const match = resolveProvider(trimmed);
    if (match && match.score >= 2) {
      router.push(`/provider/${match.id}`);
      return;
    }

    router.push(`/dashboard?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="flex items-center gap-3 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/70 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.6)] px-4 py-3 focus-within:ring-2 focus-within:ring-slate-900/20 dark:focus-within:ring-white/30 transition">
        <span className="text-slate-400 dark:text-slate-500">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M21 21l-4.35-4.35m2.1-4.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
            />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search an AI provider"
          list="provider-suggestions"
          className="flex-1 bg-transparent text-base md:text-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          aria-label="Search for a provider"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Search
        </button>
      </div>
      <datalist id="provider-suggestions">
        {providers.map((provider) => (
          <option key={provider.id} value={provider.displayName || provider.name} />
        ))}
      </datalist>
    </form>
  );
}
