'use client';

import { useState, useEffect } from 'react';

interface OfflineIndicatorProps {
  className?: string;
}

export default function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [lastOnline, setLastOnline] = useState<Date | null>(null);

  useEffect(() => {
    const updateOnlineStatus = () => {
      if (typeof navigator !== 'undefined') {
        const online = navigator.onLine;
        setIsOnline((prev) => {
          if (!online && prev) {
            setLastOnline(new Date());
          }
          return online;
        });
      }
    };

    // Initial check
    updateOnlineStatus();

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);

      return () => {
        window.removeEventListener('online', updateOnlineStatus);
        window.removeEventListener('offline', updateOnlineStatus);
      };
    }
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Connection status"
      className={`fixed top-20 left-4 right-4 z-40 ${className}`}
    >
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <svg
              className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              You&apos;re offline
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Some features may be limited until you&apos;re back online.
              {lastOnline && (
                <span className="block mt-1">Last online: {lastOnline.toLocaleTimeString()}</span>
              )}
            </p>
          </div>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="shrink-0 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium py-2 px-3 rounded-md transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

// Cache management utilities
export class StatusCache {
  private static readonly CACHE_KEY = 'ai-status-cache';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static save(data: any): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const cacheData = {
          timestamp: Date.now(),
          data,
        };
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
      }
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }

  static load(): any | null {
    try {
      if (typeof localStorage === 'undefined') return null;

      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;

      // Return cached data if it's fresh enough
      if (age < this.CACHE_DURATION) {
        return cacheData.data;
      }

      // Clean up old cache
      this.clear();
      return null;
    } catch (error) {
      console.warn('Failed to load from cache:', error);
      return null;
    }
  }

  static clear(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.CACHE_KEY);
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  static isStale(): boolean {
    try {
      if (typeof localStorage === 'undefined') return true;

      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return true;

      const cacheData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;
      return age >= this.CACHE_DURATION;
    } catch (error) {
      return true;
    }
  }
}
