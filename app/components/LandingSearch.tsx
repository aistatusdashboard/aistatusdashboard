'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type ProviderOption = {
  id: string;
  name: string;
  displayName?: string;
  aliases?: string[];
};

interface LandingSearchProps {
  providers: ProviderOption[];
  variant?: 'hero' | 'compact';
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export default function LandingSearch({ providers, variant = 'compact' }: LandingSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const lastNavigatedRef = useRef<string | null>(null);
  const showButton = variant !== 'hero';
  const containerClasses =
    variant === 'hero'
      ? 'px-6 py-4 md:px-8 md:py-5 gap-4'
      : 'px-4 py-3 gap-3';
  const inputClasses =
    variant === 'hero'
      ? 'text-lg md:text-xl'
      : 'text-base md:text-lg';

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

  const resolveProvider = useCallback(
    (value: string): { id: string; score: number } | null => {
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
    },
    [index]
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const timer = window.setTimeout(() => {
      const match = resolveProvider(trimmed);
      if (match && match.score >= 3 && match.id !== lastNavigatedRef.current) {
        lastNavigatedRef.current = match.id;
        router.push(`/provider/${match.id}`);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, resolveProvider, router]);

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
      className="w-full max-w-2xl mx-auto lg:mx-0"
    >
      <div
        className={`flex items-center rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/70 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.6)] focus-within:ring-2 focus-within:ring-slate-900/15 dark:focus-within:ring-white/25 transition ${containerClasses}`}
      >
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
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            const nativeEvent = event.nativeEvent as InputEvent;
            if (nativeEvent?.inputType === 'insertReplacementText') {
              const match = resolveProvider(nextValue);
              if (match && match.score >= 2) {
                lastNavigatedRef.current = match.id;
                router.push(`/provider/${match.id}`);
              }
            }
          }}
          placeholder="Search an AI provider"
          list="provider-suggestions"
          className={`flex-1 bg-transparent ${inputClasses} text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none`}
          aria-label="Search for a provider"
        />
        {showButton ? (
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Search
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center rounded-full border border-slate-200/70 dark:border-slate-700/70 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
            ↵
          </kbd>
        )}
      </div>
      <datalist id="provider-suggestions">
        {providers.map((provider) => (
          <option key={provider.id} value={provider.displayName || provider.name} />
        ))}
      </datalist>
    </form>
  );
}
