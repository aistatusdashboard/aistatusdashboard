'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { AnalyticsOverview, ProviderAnalytics } from '@/lib/types/analytics';
import ClientTimestamp from './ClientTimestamp';

interface AnalyticsDashboardProps {
  className?: string;
}

const WINDOW_DAYS = 7;

export default function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [topProviders, setTopProviders] = useState<ProviderAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'providers'>('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      const [overviewRes, providersRes] = await Promise.all([
        fetch(`/api/analytics/overview?windowDays=${WINDOW_DAYS}`),
        fetch(`/api/analytics/providers?windowDays=${WINDOW_DAYS}&limit=12`),
      ]);

      if (overviewRes.ok) {
        setOverview(await overviewRes.json());
      }
      if (providersRes.ok) {
        setTopProviders(await providersRes.json());
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value: number) => value.toLocaleString('en-US');

  const eventCounts = overview?.eventCounts;
  const commentsSubmitted = eventCounts?.commentsSubmitted ?? eventCounts?.comments ?? 0;
  const commentsApproved = eventCounts?.commentsApproved ?? 0;
  const commentsPending = Math.max(commentsSubmitted - commentsApproved, 0);
  const totalTracked = overview?.totalEvents || 0;

  const eventMix = useMemo(() => {
    if (!eventCounts) return [];
    const entries = [
      { label: 'Page Views', value: eventCounts.pageViews, color: 'bg-cyan-500' },
      { label: 'Provider Clicks', value: eventCounts.providerClicks, color: 'bg-emerald-500' },
      { label: 'Alert Sign-ups', value: eventCounts.subscriptions, color: 'bg-amber-500' },
      { label: 'Comments submitted', value: commentsSubmitted, color: 'bg-rose-500' },
      { label: 'Exports & Shares', value: eventCounts.exports, color: 'bg-slate-500' },
    ];
    return entries.filter((entry) => entry.value > 0);
  }, [eventCounts, commentsSubmitted]);

  if (loading) {
    return (
      <div className={`surface-card-strong p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200/70 dark:bg-slate-700/70 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-200/70 dark:bg-slate-700/70 rounded"></div>
            ))}
          </div>
          <div className="h-48 bg-slate-200/70 dark:bg-slate-700/70 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`surface-card-strong ${className}`} data-tour="analytics-overview">
      <div className="border-b border-slate-200/70 dark:border-slate-700/70 px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Analytics
            </p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mt-2">
              Audience Signals & Cost Inputs
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Public engagement signals from the last {WINDOW_DAYS} days.
            </p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Last activity{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {overview?.lastEventAt ? (
                <ClientTimestamp format="datetime" date={new Date(overview.lastEventAt)} />
              ) : (
                'No recent activity'
              )}
            </span>
          </div>
        </div>
        <div className="mt-4 surface-card p-2 inline-flex gap-2">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'providers', label: 'Providers' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as 'overview' | 'providers')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                selectedTab === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {selectedTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="surface-card p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Active Sessions
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatNumber(overview?.uniqueSessions || 0)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Last {WINDOW_DAYS} days
                </div>
              </div>
              <div className="surface-card p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Engagement Actions
                </div>
                <div
                  className="text-2xl font-semibold text-slate-900 dark:text-white"
                  data-testid="total-interactions"
                >
                  {formatNumber(overview?.totalEvents || 0)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Tracked signals</div>
              </div>
              <div className="surface-card p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Provider Clicks
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatNumber(eventCounts?.providerClicks || 0)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Status link taps</div>
              </div>
              <div className="surface-card p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Alert Sign-ups
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {formatNumber(eventCounts?.subscriptions || 0)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Requests started</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="surface-card p-4" data-tour="analytics-metrics">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Engagement Mix
                </h3>
                {totalTracked === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No tracked events yet.
                  </div>
                ) : (
                  <>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100/80 dark:bg-slate-800/70">
                      {eventMix.map((entry) => (
                        <div
                          key={entry.label}
                          className={entry.color}
                          style={{ width: `${(entry.value / totalTracked) * 100}%` }}
                          title={`${entry.label}: ${entry.value}`}
                        />
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
                      {eventMix.map((entry) => (
                        <div key={entry.label} className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${entry.color}`} />
                          <span className="flex-1">{entry.label}</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {formatNumber(entry.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="surface-card p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  Community Pulse
                </h3>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Comments posted</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatNumber(commentsApproved)}
                    </span>
                  </div>
                  {commentsPending > 0 && (
                    <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                      <span>Pending review</span>
                      <span className="font-semibold">{formatNumber(commentsPending)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>Exports & shares</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatNumber(eventCounts?.exports || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Page views</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatNumber(eventCounts?.pageViews || 0)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/70 p-3 text-xs text-slate-500 dark:text-slate-400">
                    Use alerts and RSS to turn this interest into recurring engagement.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedTab === 'providers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Top Providers by Engagement
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Last {WINDOW_DAYS} days
              </span>
            </div>

            {topProviders.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  No provider engagement yet
                </p>
                <p className="text-sm mt-2">Real interactions will show up automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topProviders.map((provider) => (
                  <div
                    key={provider.providerId}
                    data-testid="provider-engagement-item"
                    data-provider={provider.providerId}
                    className="surface-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">
                          {provider.providerName}
                        </h4>
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          {provider.tier} engagement
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-900 dark:text-white">
                          {formatNumber(provider.totalInteractions)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Total interactions
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">Clicks</div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {formatNumber(provider.interactionsByType.clicks)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">Subscriptions</div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {formatNumber(provider.interactionsByType.subscriptions)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">Engagement Score</div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {formatNumber(provider.popularityScore)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/70 dark:border-slate-700/70 p-4">
        <button
          onClick={loadAnalyticsData}
          disabled={loading}
          className="w-full cta-primary"
        >
          {loading ? 'Loading...' : 'Refresh Analytics'}
        </button>
      </div>
    </div>
  );
}
