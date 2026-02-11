'use client';

import { useState, useEffect } from 'react';
import { StatusResult } from '@/lib/types';
import type { EarlyWarningSignal, StalenessSignal } from '@/lib/types/insights';
import NotificationPanel from './NotificationPanel';
import APIDemo from './APIDemo';
import CommentSection from './CommentSection';
import ClientTimestamp from './ClientTimestamp';
import AnalyticsDashboard from './AnalyticsDashboard';
import InsightsLab from './InsightsLab';
import ExportShare from './ExportShare';
import ProviderTimeline from './ProviderTimeline';
import ProviderCompare from './ProviderCompare';
import ProviderDetailPanel from './ProviderDetailPanel';
import GuidedTour from './GuidedTour';
import TelemetryBeacon from './TelemetryBeacon';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/utils/analytics-client';

interface DashboardTabsProps {
  statuses?: StatusResult[];
}

const VALID_TABS = ['dashboard', 'notifications', 'api', 'comments', 'analytics', 'reliability'] as const;
type DashboardTabId = typeof VALID_TABS[number];
const STATUS_FILTERS = [
  'all',
  'operational',
  'degraded',
  'partial_outage',
  'down',
  'major_outage',
  'maintenance',
  'unknown',
] as const;
const SPEED_FILTERS = ['all', 'fast', 'medium', 'slow'] as const;
const UPTIME_FILTERS = ['all', 'excellent', 'good', 'poor'] as const;
const SORT_KEYS = ['name', 'status', 'responseTime', 'lastChecked'] as const;
const SORT_ORDERS = ['asc', 'desc'] as const;

type StatusFilter = typeof STATUS_FILTERS[number];
type SpeedFilter = typeof SPEED_FILTERS[number];
type UptimeFilter = typeof UPTIME_FILTERS[number];
type SortKey = typeof SORT_KEYS[number];
type SortOrder = typeof SORT_ORDERS[number];
type TourMode = 'full' | DashboardTabId;

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Dashboard error handled by error boundary
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Something went wrong
            </h3>
            <p className="text-red-600 dark:text-red-400 mb-4">
              {this.state.error?.message ||
                'An unexpected error occurred while rendering the dashboard.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Reload Page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default function DashboardTabs({ statuses = [] }: DashboardTabsProps) {
  // Initialize ALL hooks first - React requires hooks to be called in the same order
  const [activeTab, setActiveTab] = useState<
    DashboardTabId
  >('dashboard');

  const router = useRouter();
  const searchParams = useSearchParams();
  const basePath = '/dashboard';

  // Sync tab selection from the URL (supports navbar links + back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && (VALID_TABS as readonly string[]).includes(tabParam)) {
      setActiveTab(tabParam as DashboardTabId);
    } else {
      setActiveTab('dashboard');
    }
  }, [searchParams]);

  useEffect(() => {
    trackEvent('page_view', { metadata: { path: window.location.pathname } });
  }, []);

  useEffect(() => {
    trackEvent('tab_view', { metadata: { tab: activeTab } });
  }, [activeTab]);

  const setTab = (tab: DashboardTabId) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());

    if (tab === 'dashboard') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }

    const query = params.toString();
    setIsUrlSync(true);
    router.replace(query ? `${basePath}?${query}` : basePath, { scroll: false });
  };

  const startTour = (mode: TourMode) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('ai-status:start-tour', { detail: { mode } }));
  };

  const navigateToNotifications = (providers: string[], mode?: 'email' | 'webhooks') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'notifications');
    if (providers.length > 0) {
      params.set('providers', providers.join(','));
    } else {
      params.delete('providers');
    }
    if (mode) {
      params.set('notify', mode);
    } else {
      params.delete('notify');
    }
    setIsUrlSync(true);
    router.replace(`${basePath}?${params.toString()}`, { scroll: false });
  };

  const toggleWatchlist = (providerId: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(providerId)
        ? prev.filter((id) => id !== providerId)
        : [...prev, providerId];
      trackEvent('watchlist_toggle', { providerId, metadata: { enabled: !prev.includes(providerId) } });
      return next;
    });
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryDebounced, setSearchQueryDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [responseTimeFilter, setResponseTimeFilter] = useState<SpeedFilter>('all');
  const [uptimeFilter, setUptimeFilter] = useState<UptimeFilter>('all');
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [earlyWarnings, setEarlyWarnings] = useState<EarlyWarningSignal[]>([]);
  const [earlyWarningsLoading, setEarlyWarningsLoading] = useState(false);
  const [stalenessSignals, setStalenessSignals] = useState<StalenessSignal[]>([]);
  const [stalenessLoading, setStalenessLoading] = useState(false);
  const [isUrlSync, setIsUrlSync] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('ai-status-watchlist');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setWatchlist(parsed.filter((item) => typeof item === 'string'));
      }
    } catch {
      // Ignore malformed watchlist storage
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('ai-status-watchlist', JSON.stringify(watchlist));
    } catch {
      // Ignore storage failures
    }
  }, [watchlist]);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    let active = true;
    setEarlyWarningsLoading(true);
    setStalenessLoading(true);
    fetch('/api/insights/early-warnings?windowMinutes=30')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setEarlyWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
      })
      .catch(() => {
        if (active) setEarlyWarnings([]);
      })
      .finally(() => {
        if (active) setEarlyWarningsLoading(false);
      });
    fetch('/api/insights/staleness?windowMinutes=30')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setStalenessSignals(Array.isArray(data?.signals) ? data.signals : []);
      })
      .catch(() => {
        if (active) setStalenessSignals([]);
      })
      .finally(() => {
        if (active) setStalenessLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab]);

  const parseParam = <T extends string>(
    value: string | null,
    allowed: readonly T[],
    fallback: T
  ): T => {
    if (!value) return fallback;
    return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
  };

  // Sync filters from URL
  useEffect(() => {
    if (isUrlSync) {
      setIsUrlSync(false);
      return;
    }
    const params = new URLSearchParams(searchParamsString);
    const qParam = params.get('q') || '';
    const statusParam = parseParam(params.get('status'), STATUS_FILTERS, 'all');
    const speedParam = parseParam(params.get('speed'), SPEED_FILTERS, 'all');
    const uptimeParam = parseParam(params.get('uptime'), UPTIME_FILTERS, 'all');
    const sortParam = parseParam(params.get('sort'), SORT_KEYS, 'name');
    const orderParam = parseParam(params.get('order'), SORT_ORDERS, 'asc');
    const issuesParam = params.get('issues');
    const issuesValue = issuesParam === '1' || issuesParam === 'true';

    setSearchQuery(qParam);
    setSearchQueryDebounced(qParam);
    setStatusFilter(statusParam);
    setResponseTimeFilter(speedParam);
    setUptimeFilter(uptimeParam);
    setSortBy(sortParam);
    setSortOrder(orderParam);
    setIssuesOnly(issuesValue);
  }, [isUrlSync, searchParamsString]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQueryDebounced(searchQuery);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  // Sync filters to URL for shareable views
  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    if (searchQueryDebounced) params.set('q', searchQueryDebounced);
    else params.delete('q');

    if (statusFilter !== 'all') params.set('status', statusFilter);
    else params.delete('status');

    if (responseTimeFilter !== 'all') params.set('speed', responseTimeFilter);
    else params.delete('speed');

    if (uptimeFilter !== 'all') params.set('uptime', uptimeFilter);
    else params.delete('uptime');

    if (sortBy !== 'name') params.set('sort', sortBy);
    else params.delete('sort');

    if (sortOrder !== 'asc') params.set('order', sortOrder);
    else params.delete('order');

    if (issuesOnly) params.set('issues', '1');
    else params.delete('issues');

    const current = searchParamsString;
    const next = params.toString();
    if (next !== current) {
      setIsUrlSync(true);
      router.replace(next ? `${basePath}?${next}` : basePath, { scroll: false });
    }
  }, [
    searchQueryDebounced,
    statusFilter,
    responseTimeFilter,
    uptimeFilter,
    sortBy,
    sortOrder,
    issuesOnly,
    searchParamsString,
    router,
  ]);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on '/' key (both regular slash and numpad slash)
      if ((e.key === '/' || e.code === 'NumpadDivide') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        // Only focus if we're on dashboard tab and search input exists
        if (activeTab === 'dashboard' && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [activeTab]);

  // Calculate stats safely
  const safeStatuses = statuses.filter(
    (s) => s && typeof s === 'object' && s.status && s.id && s.name
  );
  const unverifiedCount = safeStatuses.filter((s) => s.status === 'unknown').length;
  const rawStatusById = React.useMemo(
    () => new Map(safeStatuses.map((status) => [status.id, status.status])),
    [safeStatuses]
  );
  const displayStatuses = React.useMemo<StatusResult[]>(
    () =>
      safeStatuses.map((status) => {
        if (status.status !== 'unknown') return status;
        const note = 'Unverified status signal (defaulting to operational)';
        const details = status.details ? `${status.details} | ${note}` : note;
        return { ...status, status: 'operational', details };
      }),
    [safeStatuses]
  );
  const operationalCount = displayStatuses.filter((s) => s.status === 'operational').length;
  const degradedCount = displayStatuses.filter((s) => s.status === 'degraded' || s.status === 'partial_outage').length;
  const downCount = displayStatuses.filter((s) => s.status === 'down' || s.status === 'major_outage').length;
  const maintenanceCount = displayStatuses.filter((s) => s.status === 'maintenance').length;

  const avgResponseTime =
    displayStatuses.length > 0
      ? Math.round(
          displayStatuses.reduce(
            (acc, s) => acc + (typeof s.responseTime === 'number' ? s.responseTime : 0),
            0
          ) / displayStatuses.length
        )
      : 0;

  const healthPercentage =
    displayStatuses.length > 0
      ? Math.round(((operationalCount + maintenanceCount) / displayStatuses.length) * 100)
      : 0;

  // Calculate global last updated time
  const lastUpdated = React.useMemo(() => {
    const timestamps = displayStatuses
      .map((s) => s.lastChecked)
      .filter(Boolean)
      .map((t) => new Date(t).getTime())
      .sort((a, b) => b - a); // Sort descending to get most recent

    return timestamps.length > 0 ? new Date(timestamps[0]) : null;
  }, [displayStatuses]);

  const systemStatus = React.useMemo(() => {
    if (downCount > 0)
      return {
        status: 'issues',
        label: 'Service issues detected',
        tone: 'text-rose-700 dark:text-rose-300',
        dot: 'bg-rose-500',
      };
    if (degradedCount > 0)
      return {
        status: 'degraded',
        label: 'Some services degraded',
        tone: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
      };
    if (maintenanceCount > 0)
      return {
        status: 'maintenance',
        label: 'Scheduled maintenance in progress',
        tone: 'text-slate-600 dark:text-slate-300',
        dot: 'bg-slate-400',
      };
    if (operationalCount === displayStatuses.length && displayStatuses.length > 0) {
      return {
        status: 'operational',
        label: 'All systems operational',
        tone: 'text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500',
      };
    }
    return {
      status: 'unknown',
      label: 'Status currently unknown',
      tone: 'text-slate-600 dark:text-slate-300',
      dot: 'bg-slate-400',
    };
  }, [operationalCount, degradedCount, downCount, maintenanceCount, displayStatuses.length]);

  const majorIncidents = React.useMemo(
    () =>
      displayStatuses.filter(
        (status) =>
          status.status === 'down' ||
          status.status === 'major_outage'
      ),
    [displayStatuses]
  );
  const incidentTargets = majorIncidents.map((status) => status.id);
  const providerNameById = React.useMemo(
    () => new Map(displayStatuses.map((status) => [status.id, status.displayName || status.name])),
    [displayStatuses]
  );

  // Filter and sort statuses
  const filteredAndSortedStatuses = React.useMemo(() => {
    const safeStatuses = displayStatuses.filter(
      (s) => s && typeof s === 'object' && s.status && s.id && s.name
    );
    const normalizedQuery = searchQueryDebounced.trim().toLowerCase();

    // Apply search filter (name + aliases)
    let filtered = safeStatuses.filter((status) => {
      if (!normalizedQuery) return true;
      const haystack = [
        status.name,
        status.displayName,
        status.id,
        ...(status.aliases || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    if (issuesOnly) {
      filtered = filtered.filter(
        (status) => status.status === 'degraded' || status.status === 'down'
      );
    }

    if (watchlistOnly) {
      filtered = filtered.filter((status) => watchlist.includes(status.id));
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((status) =>
        statusFilter === 'unknown'
          ? rawStatusById.get(status.id) === 'unknown'
          : status.status === statusFilter
      );
    }

    // Apply response time filter
    if (responseTimeFilter !== 'all') {
      filtered = filtered.filter((status) => {
        const responseTime = typeof status.responseTime === 'number' ? status.responseTime : 999999;
        switch (responseTimeFilter) {
          case 'fast':
            return responseTime <= 100;
          case 'medium':
            return responseTime > 100 && responseTime <= 500;
          case 'slow':
            return responseTime > 500;
          default:
            return true;
        }
      });
    }

    // Apply uptime filter
    if (uptimeFilter !== 'all') {
      filtered = filtered.filter((status) => {
        // Calculate uptime percentage (same logic as in renderStatusCard)
        const uptimePercentage =
          status.status === 'operational'
            ? 99.9
            : status.status === 'degraded'
              ? 95.0
              : status.status === 'down'
                ? 0.0
                : 85.0;

        switch (uptimeFilter) {
          case 'excellent':
            return uptimePercentage >= 99;
          case 'good':
            return uptimePercentage >= 95 && uptimePercentage < 99;
          case 'poor':
            return uptimePercentage < 95;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = (a.displayName || a.name).toLowerCase();
          bValue = (b.displayName || b.name).toLowerCase();
          break;
        case 'status':
          // Sort by status priority: operational > degraded > down > unknown
          const statusPriority = {
            operational: 6,
            degraded: 5,
            partial_outage: 4,
            maintenance: 3,
            down: 2,
            major_outage: 1,
            unknown: 0,
          };
          aValue = statusPriority[a.status as keyof typeof statusPriority] || 0;
          bValue = statusPriority[b.status as keyof typeof statusPriority] || 0;
          break;
        case 'responseTime':
          aValue = typeof a.responseTime === 'number' ? a.responseTime : 999999;
          bValue = typeof b.responseTime === 'number' ? b.responseTime : 999999;
          break;
        case 'lastChecked':
          aValue = new Date(a.lastChecked || 0).getTime();
          bValue = new Date(b.lastChecked || 0).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [displayStatuses, rawStatusById, searchQueryDebounced, statusFilter, responseTimeFilter, uptimeFilter, sortBy, sortOrder, issuesOnly, watchlistOnly, watchlist]);

  // Validate statuses prop after hooks initialization
  if (!Array.isArray(statuses)) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
          Invalid Data
        </h3>
        <p className="text-yellow-600 dark:text-yellow-400">
          Status data is not in the expected format. Please try refreshing the page.
        </p>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Status Dashboard', count: filteredAndSortedStatuses.length },
    { id: 'analytics', label: 'Analytics', count: null },
    { id: 'reliability', label: 'Reliability Lab', count: null },
    { id: 'notifications', label: 'Notifications', count: null },
    { id: 'api', label: 'API & Badges', count: null },
    { id: 'comments', label: 'Comments', count: null },
  ];

  const tabHeadings: Record<Exclude<DashboardTabId, 'dashboard'>, { title: string; description: string }> = {
    analytics: {
      title: 'Engagement & Insights',
      description: 'See how teams interact with the dashboard and compare provider reliability.',
    },
    reliability: {
      title: 'Reliability Lab',
      description: 'Deep diagnostics, model-level telemetry, and fallback guidance.',
    },
    notifications: {
      title: 'Alerts & Incidents',
      description: 'Subscribe to the providers you care about and stay ahead of outages.',
    },
    api: {
      title: 'Developer Tools',
      description: 'Ship live status checks, badges, and RSS into your apps.',
    },
    comments: {
      title: 'Community Feedback',
      description: 'Collect real-world signal and keep the conversation grounded.',
    },
  };

  const renderStatusCard = (status: StatusResult) => {
    // Validate status object
    if (!status || typeof status !== 'object' || !status.id || !status.name) {
      return null;
    }
    const displayName = status.displayName || status.name;

    const statusToneMap = {
      operational: {
        pill: 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
        dot: 'bg-emerald-500',
      },
      degraded: {
        pill: 'bg-amber-100/70 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
        dot: 'bg-amber-500',
      },
      partial_outage: {
        pill: 'bg-amber-100/70 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
        dot: 'bg-amber-500',
      },
      down: {
        pill: 'bg-rose-100/70 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
        dot: 'bg-rose-500',
      },
      major_outage: {
        pill: 'bg-rose-100/70 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
        dot: 'bg-rose-500',
      },
      maintenance: {
        pill: 'bg-slate-100/70 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
        dot: 'bg-slate-400',
      },
      unknown: {
        pill: 'bg-slate-100/70 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
        dot: 'bg-slate-400',
      },
    } as const;

    const statusTone = statusToneMap[status.status as keyof typeof statusToneMap] || statusToneMap.unknown;

    // Calculate uptime percentage (simplified - in production this would come from historical data)
    const uptimePercentage =
      status.status === 'operational'
        ? 99.9
        : status.status === 'degraded' || status.status === 'partial_outage'
          ? 95.0
          : status.status === 'down' || status.status === 'major_outage'
            ? 0.0
            : status.status === 'maintenance'
              ? 99.0
            : 85.0; // unknown

    const uptimeColor =
      uptimePercentage >= 99
        ? 'text-green-700 dark:text-green-400'
        : uptimePercentage >= 95
          ? 'text-yellow-700 dark:text-yellow-400'
          : 'text-red-600 dark:text-red-400';

    const isWatched = watchlist.includes(status.id);

    return (
      <div
        key={status.id}
        className="surface-card p-5 transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.5)]"
        data-testid="provider-card"
        data-provider={status.id}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 flex items-center justify-center">
              <Image
                src={`/logos/${status.id}.svg`}
                alt={`${displayName} logo`}
                className="w-6 h-6"
                width={24}
                height={24}
                loading="lazy"
                unoptimized
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src.endsWith('.svg')) {
                    target.src = `/logos/${status.id}.png`;
                  } else {
                    target.style.display = 'none';
                  }
                }}
              />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">{displayName}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{status.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusTone.pill}`}
              data-testid="provider-status"
            >
              <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
              <span className="capitalize">{status.status}</span>
            </span>
            <button
              onClick={() => toggleWatchlist(status.id)}
              className={`h-9 w-9 rounded-full border transition ${
                isWatched
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                  : 'border-slate-200/80 bg-white/80 text-slate-500 hover:text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300'
              }`}
              aria-pressed={isWatched}
              title={isWatched ? 'Remove from watchlist' : 'Save to watchlist'}
            >
              <svg
                className="w-4 h-4 mx-auto"
                viewBox="0 0 24 24"
                fill={isWatched ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 17.27l5.18 3.05-1.4-5.97 4.62-4.01-6.08-.52L12 4.5 9.68 9.82 3.6 10.34l4.62 4.01-1.4 5.97L12 17.27z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Latency
            </p>
            <p
              className="font-semibold text-slate-900 dark:text-white"
              data-testid="response-time"
            >
              {typeof status.responseTime === 'number' ? `${status.responseTime}ms` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Uptime (30d)
            </p>
            <p className={`font-semibold ${uptimeColor}`}>{uptimePercentage.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Last Check
            </p>
            <p className="font-semibold text-slate-900 dark:text-white">
              {status.lastChecked ? (
                <ClientTimestamp format="time" date={new Date(status.lastChecked)} />
              ) : (
                'N/A'
              )}
            </p>
          </div>
        </div>

        {status.details && (
          <div className="mt-4 rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/60 p-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <strong className="text-slate-700 dark:text-slate-200">Details:</strong> {status.details}
            </p>
          </div>
        )}

        {status.error && (
          <div className="mt-4 rounded-xl border border-rose-200/70 dark:border-rose-700/70 bg-rose-50/80 dark:bg-rose-900/30 p-3">
            <p className="text-xs text-rose-700 dark:text-rose-200">
              <strong>Error:</strong> {status.error}
            </p>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-wrap gap-2 items-center">
          <Link
            href={`/provider/${status.id}`}
            onClick={() =>
              trackEvent('provider_detail_click', {
                providerId: status.id,
                metadata: { providerName: displayName },
              })
            }
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Provider page &gt;
          </Link>
          <a
            href={status.statusPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent('provider_click', {
                providerId: status.id,
                metadata: { providerName: displayName },
              })
            }
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            data-testid="official-status-link"
          >
            Status page &gt;
          </a>
          <button
            onClick={() => {
              navigateToNotifications([status.id], 'email');
              trackEvent('provider_alerts_click', { providerId: status.id });
            }}
            className="px-3 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 min-h-[36px]"
          >
            Email alerts
          </button>
          <button
            onClick={() => {
              navigateToNotifications([status.id], 'webhooks');
              trackEvent('provider_webhook_click', { providerId: status.id });
            }}
            className="px-3 py-2 text-xs font-semibold rounded-full border border-slate-300/80 text-slate-700 hover:text-slate-900 dark:border-slate-600/80 dark:text-slate-200 dark:hover:text-white min-h-[36px]"
          >
            Webhook alerts
          </button>
          <a
            href={`/rss.xml?provider=${status.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs font-semibold rounded-full border border-slate-200/80 text-slate-600 hover:text-slate-900 dark:border-slate-700/70 dark:text-slate-300 dark:hover:text-white min-h-[36px]"
          >
            RSS feed
          </a>
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <TelemetryBeacon statuses={statuses} />
      <GuidedTour activeTab={activeTab} setTab={setTab} />
      <div className="max-w-6xl mx-auto space-y-8">
        {activeTab === 'dashboard' && majorIncidents.length > 0 && (
          <div className="surface-card border-l-4 border-rose-500 p-4" data-tour="dashboard-major-incidents">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-rose-600 dark:text-rose-300 mb-2">
                  Major incidents
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  {majorIncidents.map((status) => status.displayName || status.name).join(', ')}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {majorIncidents.slice(0, 3).map((status) => (
                  <button
                    key={status.id}
                    onClick={() => {
                      navigateToNotifications([status.id], 'email');
                      trackEvent('major_incident_subscribe', { providerId: status.id });
                    }}
                    className="px-3 py-2 text-xs font-semibold rounded-full bg-rose-600 text-white min-h-[36px]"
                  >
                    Alerts for {status.displayName || status.name}
                  </button>
                ))}
                {majorIncidents.length > 3 && (
                  <button
                    onClick={() => {
                      navigateToNotifications(incidentTargets, 'email');
                      trackEvent('major_incident_subscribe_all');
                    }}
                    className="px-3 py-2 text-xs font-semibold rounded-full border border-rose-200/70 text-rose-700 dark:text-rose-200 min-h-[36px]"
                  >
                    Alerts for all
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <section className="surface-card-strong p-6" data-tour="dashboard-early-warnings">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Early warning signals
                </p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-2">
                  Suspected incidents before official updates
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Window: 30 minutes
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {earlyWarningsLoading && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Scanning synthetic and crowd telemetry...
                </div>
              )}
              {!earlyWarningsLoading && earlyWarnings.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No early warning signals detected in the last 30 minutes.
                </div>
              )}
              {earlyWarnings.map((warning) => {
                const toneBorder = warning.risk === 'high' ? 'border-rose-500' : 'border-amber-400';
                const toneText =
                  warning.risk === 'high'
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'text-amber-600 dark:text-amber-300';
                return (
                  <div key={warning.id} className={`surface-card p-4 border-l-4 ${toneBorder}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {providerNameById.get(warning.providerId) || warning.providerId}
                      </div>
                      <span className={`text-xs uppercase tracking-[0.2em] ${toneText}`}>
                        {warning.risk}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                      {warning.summary}
                    </p>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                      {warning.affectedModels.length > 0 && (
                        <span>Models: {warning.affectedModels.slice(0, 4).join(', ')}</span>
                      )}
                      {warning.affectedRegions.length > 0 && (
                        <span>Regions: {warning.affectedRegions.slice(0, 3).join(', ')}</span>
                      )}
                      <span>Samples: {warning.evidence.sampleCount}</span>
                      {warning.fingerprint?.tags?.length ? (
                        <span>Fingerprint: {warning.fingerprint.tags.join(', ')}</span>
                      ) : null}
                      {warning.evidence.snapshot ? <span>{warning.evidence.snapshot}</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'dashboard' && (
          <section className="surface-card-strong p-6" data-tour="dashboard-staleness">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Official vs observed
                </p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-2">
                  Status staleness detector
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Window: 30 minutes
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {stalenessLoading && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Checking for official status drift...
                </div>
              )}
              {!stalenessLoading && stalenessSignals.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No mismatches detected between official status and observed telemetry.
                </div>
              )}
              {stalenessSignals.map((signal) => {
                const toneBorder =
                  signal.observedSignal === 'down' ? 'border-rose-500' : 'border-amber-400';
                const toneText =
                  signal.observedSignal === 'down'
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'text-amber-600 dark:text-amber-300';
                return (
                  <div key={signal.providerId} className={`surface-card p-4 border-l-4 ${toneBorder}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {providerNameById.get(signal.providerId) || signal.providerId}
                      </div>
                      <span className={`text-xs uppercase tracking-[0.2em] ${toneText}`}>
                        {signal.observedSignal}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                      Official status: {signal.officialStatus}. Observed probes/telemetry: {signal.observedSignal}.
                      This is an advisory mismatch only and does not change the published status.
                    </p>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                      <span>Samples: {signal.evidence.sampleCount}</span>
                      {signal.evidence.sources.length > 0 && (
                        <span>Sources: {signal.evidence.sources.join(', ')}</span>
                      )}
                      {signal.confidence && <span>Confidence: {signal.confidence}</span>}
                      {signal.note && <span>{signal.note}</span>}
                      {signal.evidence.snapshot && <span>{signal.evidence.snapshot}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'dashboard' ? (
          <section
            className="surface-card-strong relative overflow-hidden p-6 md:p-8 fade-rise"
            data-tour="dashboard-summary"
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 -right-10 h-52 w-52 rounded-full bg-cyan-400/15 blur-3xl" />
              <div className="absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
            </div>
            <div className="relative grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Live status
                  </p>
                  <button
                    type="button"
                    onClick={() => startTour('dashboard')}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    Tour dashboard
                  </button>
                </div>
                <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-2">
                  {systemStatus.label}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <span className={`inline-flex items-center gap-2 ${systemStatus.tone}`}>
                    <span className={`h-2 w-2 rounded-full ${systemStatus.dot}`} />
                    {systemStatus.status}
                  </span>
                  <span>Tracking {safeStatuses.length} providers</span>
                  <span className="text-slate-400">|</span>
                  <span>
                    Updated{' '}
                    {lastUpdated ? <ClientTimestamp format="time" date={lastUpdated} /> : 'N/A'}
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="pill">Operational: {operationalCount}</span>
                  <span className="pill">Degraded: {degradedCount}</span>
                  <span className="pill">Down: {downCount}</span>
                  {maintenanceCount > 0 && <span className="pill">Maintenance: {maintenanceCount}</span>}
                  {unverifiedCount > 0 && <span className="pill">Unverified: {unverifiedCount}</span>}
                  <span className="pill">Avg latency: {avgResponseTime}ms</span>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Official status is aggregate across tiers/models. Real-world experience can vary by model,
                  endpoint, or region — we overlay canaries and telemetry to show the difference.
                </p>
              </div>
              <div className="surface-card p-5" data-tour="dashboard-engage">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Engage
                </p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-2">
                  Stay ahead of incidents
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Create a watchlist and get notified when providers change status.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigateToNotifications(incidentTargets, 'email')}
                    className="cta-primary"
                  >
                    Email alerts
                  </button>
                  <button
                    onClick={() => navigateToNotifications(incidentTargets, 'webhooks')}
                    className="cta-secondary"
                  >
                    Webhook alerts
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <div>Updates every 60s</div>
                  <div>{healthPercentage}% healthy</div>
                  <div>{avgResponseTime}ms avg latency</div>
                  <div>{watchlist.length} saved providers</div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="surface-card-strong p-6 fade-rise">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Section
            </p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mt-2">
              {tabHeadings[activeTab as Exclude<DashboardTabId, 'dashboard'>].title}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              {tabHeadings[activeTab as Exclude<DashboardTabId, 'dashboard'>].description}
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => startTour(activeTab as DashboardTabId)}
                className="cta-secondary text-xs"
              >
                Tour this section
              </button>
            </div>
          </section>
        )}

        <div className="surface-card p-2" data-tour="tab-bar">
          <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id as any)}
                  data-testid={tab.id === 'notifications' ? 'notifications-button' : undefined}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                >
                  {tab.label}
                  {tab.count && (
                  <span className="bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs px-2 py-1 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'dashboard' && (
          <ErrorBoundary
            fallback={
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  Unable to load dashboard content
                </p>
              </div>
            }
          >
            <div className="space-y-6">
              <div className="surface-card p-4" data-tour="dashboard-filters">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                  <div className="flex-1">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          className="h-5 w-5 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search providers... (Press / to focus)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setSearchQuery('');
                            e.currentTarget.blur();
                          }
                        }}
                        className="block w-full pl-10 pr-3 py-3 border border-slate-200/70 dark:border-slate-700/70 rounded-xl leading-5 bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/70"
                        ref={searchInputRef}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 min-h-[44px] min-w-[44px] justify-center"
                          aria-label="Clear search"
                          title="Clear search"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      {filteredAndSortedStatuses.length} of {statuses.length} providers shown
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <label
                        htmlFor="status-filter"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap"
                      >
                        Status
                      </label>
                      <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400/70 text-xs"
                      >
                        <option value="all">All</option>
                        <option value="operational">Operational</option>
                        <option value="degraded">Degraded</option>
                        <option value="partial_outage">Partial Outage</option>
                        <option value="down">Down</option>
                        <option value="major_outage">Major Outage</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="unknown">Unverified</option>
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        setIssuesOnly((prev) => {
                          const next = !prev;
                          if (next) setStatusFilter('all');
                          trackEvent('issues_only_toggle', { metadata: { enabled: next } });
                          return next;
                        });
                      }}
                      className={`px-3 py-2 text-xs font-semibold rounded-full border min-h-[36px] ${
                        issuesOnly
                          ? 'bg-rose-600 border-rose-600 text-white'
                          : 'border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300'
                      }`}
                      title="Show only degraded or down providers"
                    >
                      Issues only
                    </button>

                    <button
                      onClick={() => {
                        if (watchlist.length === 0) return;
                        setWatchlistOnly((prev) => {
                          const next = !prev;
                          trackEvent('watchlist_filter_toggle', { metadata: { enabled: next } });
                          return next;
                        });
                      }}
                      className={`px-3 py-2 text-xs font-semibold rounded-full border min-h-[36px] ${
                        watchlistOnly
                          ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300'
                      } ${watchlist.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Show watchlist providers only"
                    >
                      Watchlist ({watchlist.length})
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                      <label
                        htmlFor="speed-filter"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap"
                      >
                        Speed
                      </label>
                      <select
                        id="speed-filter"
                        value={responseTimeFilter}
                        onChange={(e) => setResponseTimeFilter(e.target.value as any)}
                        className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400/70 text-xs"
                      >
                        <option value="all">All</option>
                        <option value="fast">Fast</option>
                        <option value="medium">Medium</option>
                        <option value="slow">Slow</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <label
                        htmlFor="uptime-filter"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap"
                      >
                        Uptime
                      </label>
                      <select
                        id="uptime-filter"
                        value={uptimeFilter}
                        onChange={(e) => setUptimeFilter(e.target.value as any)}
                        className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400/70 text-xs"
                      >
                        <option value="all">All</option>
                        <option value="excellent">Excellent</option>
                        <option value="good">Good</option>
                        <option value="poor">Poor</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <label
                        htmlFor="sort-filter"
                        className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap"
                      >
                        Sort
                      </label>
                      <select
                        id="sort-filter"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400/70 text-xs"
                      >
                        <option value="name">Name</option>
                        <option value="status">Status</option>
                        <option value="responseTime">Response Time</option>
                        <option value="lastChecked">Last Checked</option>
                      </select>
                      <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="p-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/70 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                        aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                      >
                        <svg
                          className={`h-4 w-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 11l5-5m0 0l5 5m-5-5v12"
                          />
                        </svg>
                      </button>
                    </div>

                    {(searchQuery ||
                      statusFilter !== 'all' ||
                      responseTimeFilter !== 'all' ||
                      uptimeFilter !== 'all' ||
                      sortBy !== 'name' ||
                      sortOrder !== 'asc' ||
                      issuesOnly ||
                      watchlistOnly) && (
                      <button
                        data-testid="clear-filters-button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setResponseTimeFilter('all');
                          setUptimeFilter('all');
                          setSortBy('name');
                          setSortOrder('asc');
                          setIssuesOnly(false);
                          setWatchlistOnly(false);
                        }}
                        className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {(searchQuery ||
                  statusFilter !== 'all' ||
                  responseTimeFilter !== 'all' ||
                  uptimeFilter !== 'all' ||
                  issuesOnly ||
                  watchlistOnly) && (
                  <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/70">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Filters active
                      {searchQuery && <span> - query &quot;{searchQuery}&quot;</span>}
                      {statusFilter !== 'all' && <span> - status {statusFilter}</span>}
                      {responseTimeFilter !== 'all' && <span> - {responseTimeFilter} latency</span>}
                      {uptimeFilter !== 'all' && <span> - {uptimeFilter} uptime</span>}
                      {issuesOnly && <span> - issues only</span>}
                      {watchlistOnly && <span> - watchlist</span>}
                    </p>
                  </div>
                )}
              </div>

              {filteredAndSortedStatuses.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tour="dashboard-provider-grid">
                  {filteredAndSortedStatuses.map(renderStatusCard)}
                </div>
              ) : (
                <div className="text-center py-12">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    No providers found
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    {searchQuery ||
                    statusFilter !== 'all' ||
                    responseTimeFilter !== 'all' ||
                    uptimeFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'No provider data available.'}
                  </p>
                  {(searchQuery ||
                    statusFilter !== 'all' ||
                    responseTimeFilter !== 'all' ||
                    uptimeFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setResponseTimeFilter('all');
                        setUptimeFilter('all');
                        setSortBy('name');
                        setSortOrder('asc');
                        setIssuesOnly(false);
                        setWatchlistOnly(false);
                      }}
                      className="cta-primary"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                <ExportShare statuses={displayStatuses} className="surface-card-strong" />
                <div className="surface-card p-6" data-tour="dashboard-stay-loop">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Stay in the loop
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                    Subscribe once, then reuse your watchlist across email, webhook, and RSS feeds.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => navigateToNotifications(incidentTargets, 'email')}
                      className="cta-primary"
                    >
                      Start alerts
                    </button>
                    <button onClick={() => setTab('notifications')} className="cta-secondary">
                      Configure webhooks
                    </button>
                    <a href="/rss.xml" className="cta-secondary">
                      RSS feed
                    </a>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>Auto-refresh every 60 seconds</span>
                    <span>|</span>
                    <span>{watchlist.length} providers saved</span>
                  </div>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'notifications' && (
          <ErrorBoundary
            fallback={
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">Unable to load notifications</p>
              </div>
            }
          >
            <NotificationPanel />
          </ErrorBoundary>
        )}

        {activeTab === 'api' && (
          <ErrorBoundary
            fallback={
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">Unable to load API demo</p>
              </div>
            }
          >
            <APIDemo />
          </ErrorBoundary>
        )}

        {activeTab === 'analytics' && (
          <ErrorBoundary
            fallback={
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  Unable to load analytics dashboard
                </p>
              </div>
            }
          >
            <div className="space-y-6">
              <AnalyticsDashboard />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProviderCompare statuses={displayStatuses} />
                <ProviderTimeline statuses={displayStatuses} />
              </div>
              <ProviderDetailPanel />
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'reliability' && (
          <ErrorBoundary
            fallback={
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">
                  Unable to load reliability lab
                </p>
              </div>
            }
          >
            <InsightsLab />
          </ErrorBoundary>
        )}

        {activeTab === 'comments' && (
          <ErrorBoundary
            fallback={
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">Unable to load comments</p>
              </div>
            }
          >
            <CommentSection title="Dashboard Comments & Feedback" className="max-w-4xl mx-auto" />
          </ErrorBoundary>
        )}
      </div>
    </ErrorBoundary>
  );
}
