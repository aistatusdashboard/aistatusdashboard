'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { providerService } from '@/lib/services/providers';
import ClientTimestamp from './ClientTimestamp';
import modelsCatalog from '@/lib/data/models.json';
import { getProbeDefaultsMap } from '@/lib/utils/probe-defaults';
import type {
  CanaryCopilotResponse,
  ModelMatrixResponse,
  ModelMatrixTile,
  FallbackPlan,
  IncidentReplayResponse,
  ForecastResponse,
  RateLimitSummary,
  ChangeRadarEvent,
  BehavioralMetricSummary,
  AskStatusResponse,
  ThroughputBaseline,
} from '@/lib/types/insights';

const PANES = [
  { id: 'canary', label: 'Canary Copilot' },
  { id: 'model', label: 'Model Detail' },
  { id: 'matrix', label: 'Model Matrix' },
  { id: 'replay', label: 'Incident Replay' },
  { id: 'forecast', label: 'Reliability Forecast' },
  { id: 'rate', label: 'Rate Limits' },
  { id: 'radar', label: 'Change Radar' },
  { id: 'behavioral', label: 'Behavioral Stability' },
  { id: 'ask', label: 'Ask Status' },
] as const;

type PaneId = typeof PANES[number]['id'];

type Catalog = {
  regions: string[];
  endpoints: string[];
  tiers: string[];
  models: Array<{ id: string; tier?: string; streaming?: boolean }>;
};

function getCatalog(providerId: string): Catalog {
  const data = (modelsCatalog as Record<string, Catalog>)[providerId];
  return data || (modelsCatalog as Record<string, Catalog>)._default;
}

function signalClass(signal: string) {
  switch (signal) {
    case 'healthy':
      return 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200';
    case 'degraded':
      return 'bg-amber-100/80 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200';
    case 'down':
      return 'bg-rose-100/80 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200';
    default:
      return 'bg-slate-100/80 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300';
  }
}

export default function InsightsLab() {
  const providers = providerService.getProviders();
  const readLocalValue = (key: string, fallback: string) => {
    if (typeof window === 'undefined') return fallback;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ?? fallback;
    } catch {
      return fallback;
    }
  };

  const [activePane, setActivePane] = useState<PaneId>('canary');
  const [providerId, setProviderId] = useState('openai');
  const [accountId, setAccountId] = useState(() => readLocalValue('ai-status-account-id', ''));

  const catalog = useMemo(() => getCatalog(providerId), [providerId]);
  const initialCatalog = getCatalog('openai');
  const initialModel = initialCatalog.models[0];
  const probeDefaultsRef = useRef<Record<string, ReturnType<typeof getProbeDefaultsMap>[string]>>({});
  const appliedDefaultsRef = useRef<Record<string, boolean>>({});
  const [model, setModel] = useState(initialModel?.id || 'core');
  const [endpoint, setEndpoint] = useState(initialCatalog.endpoints[0] || 'api');
  const [region, setRegion] = useState(initialCatalog.regions[0] || 'global');
  const [tier, setTier] = useState(initialModel?.tier || initialCatalog.tiers?.[0] || 'unknown');
  const [streaming, setStreaming] = useState(Boolean(initialModel?.streaming));

  const [canary, setCanary] = useState<CanaryCopilotResponse | null>(null);
  const [matrix, setMatrix] = useState<ModelMatrixResponse | null>(null);
  const [fallbackPlan, setFallbackPlan] = useState<FallbackPlan | null>(null);
  const [replay, setReplay] = useState<IncidentReplayResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitSummary | null>(null);
  const [rateLimitIncidents, setRateLimitIncidents] = useState<any[]>([]);
  const [throughputBaseline, setThroughputBaseline] = useState<ThroughputBaseline | null>(null);
  const [radar, setRadar] = useState<ChangeRadarEvent[]>([]);
  const [behavioral, setBehavioral] = useState<BehavioralMetricSummary | null>(null);
  const [askQuestion, setAskQuestion] = useState('Why is latency high in us-east?');
  const [askResponse, setAskResponse] = useState<AskStatusResponse | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [budgetLimit, setBudgetLimit] = useState(() => readLocalValue('ai-status-budget-limit', ''));
  const [budgetThreshold, setBudgetThreshold] = useState(() =>
    readLocalValue('ai-status-budget-threshold', '0.15')
  );
  const [failoverThreshold, setFailoverThreshold] = useState('2000');
  const [failoverTarget, setFailoverTarget] = useState('fallback-provider');
  const [radarSecret, setRadarSecret] = useState(() => readLocalValue('ai-status-change-secret', ''));
  const [radarType, setRadarType] = useState('pricing');
  const [radarSeverity, setRadarSeverity] = useState('info');
  const [radarTitle, setRadarTitle] = useState('');
  const [radarSummary, setRadarSummary] = useState('');
  const [radarEffectiveDate, setRadarEffectiveDate] = useState('');
  const [radarUrl, setRadarUrl] = useState('');
  const [radarStatus, setRadarStatus] = useState('');

  const applyProbeDefaults = (nextProviderId: string) => {
    const defaults = probeDefaultsRef.current[nextProviderId];
    if (defaults) {
      setModel(defaults.model || 'core');
      setEndpoint(defaults.endpoint || 'api');
      setRegion(defaults.region || 'global');
      setTier(defaults.tier || 'unknown');
      setStreaming(Boolean(defaults.streaming));
      appliedDefaultsRef.current[nextProviderId] = true;
      return true;
    }
    return false;
  };

  const handleProviderChange = (nextProviderId: string) => {
    setProviderId(nextProviderId);
    if (applyProbeDefaults(nextProviderId)) return;
    const nextCatalog = getCatalog(nextProviderId);
    const nextModel = nextCatalog.models[0];
    setModel(nextModel?.id || 'core');
    setEndpoint(nextCatalog.endpoints[0] || 'api');
    setRegion(nextCatalog.regions[0] || 'global');
    setTier(nextModel?.tier || nextCatalog.tiers?.[0] || 'unknown');
    setStreaming(Boolean(nextModel?.streaming));
  };

  useEffect(() => {
    probeDefaultsRef.current = getProbeDefaultsMap();
    if (!appliedDefaultsRef.current[providerId]) {
      applyProbeDefaults(providerId);
    }
  }, [providerId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ai-status-budget-limit', budgetLimit);
    window.localStorage.setItem('ai-status-budget-threshold', budgetThreshold);
  }, [budgetLimit, budgetThreshold]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (accountId) {
      window.localStorage.setItem('ai-status-account-id', accountId);
    } else {
      window.localStorage.removeItem('ai-status-account-id');
    }
  }, [accountId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (radarSecret) {
      window.localStorage.setItem('ai-status-change-secret', radarSecret);
    } else {
      window.localStorage.removeItem('ai-status-change-secret');
    }
  }, [radarSecret]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ pane?: PaneId }>).detail;
      if (!detail?.pane) return;
      const match = PANES.find((pane) => pane.id === detail.pane);
      if (match) setActivePane(match.id);
    };
    window.addEventListener('ai-status:reliability-pane', handler as EventListener);
    return () => window.removeEventListener('ai-status:reliability-pane', handler as EventListener);
  }, []);

  useEffect(() => {
    if (activePane !== 'canary' && activePane !== 'model') return;
    const params = new URLSearchParams({
      providerId,
      model,
      endpoint,
      region,
      tier,
      streaming: streaming ? 'true' : 'false',
    });
    if (accountId) params.set('accountId', accountId);
    fetch(`/api/insights/canary?${params.toString()}`)
      .then((res) => res.json())
      .then(setCanary)
      .catch(() => setCanary(null));
  }, [activePane, providerId, model, endpoint, region, tier, streaming, accountId]);

  useEffect(() => {
    if (activePane !== 'matrix') return;
    const params = new URLSearchParams({ providerId });
    fetch(`/api/insights/model-matrix?${params.toString()}`)
      .then((res) => res.json())
      .then(setMatrix)
      .catch(() => setMatrix(null));
  }, [activePane, providerId]);

  useEffect(() => {
    if (activePane !== 'replay') return;
    fetch(`/api/insights/replay?providerId=${providerId}`)
      .then((res) => res.json())
      .then((data) => {
        setReplay(data);
        setReplayIndex(Math.max(0, (data?.timeline?.length || 1) - 1));
      })
      .catch(() => setReplay(null));
  }, [activePane, providerId]);

  useEffect(() => {
    if (activePane !== 'forecast') return;
    fetch(`/api/insights/forecast?providerId=${providerId}`)
      .then((res) => res.json())
      .then(setForecast)
      .catch(() => setForecast(null));
  }, [activePane, providerId]);

  useEffect(() => {
    if (activePane !== 'rate' && activePane !== 'model') return;
    fetch(`/api/insights/rate-limits?providerId=${providerId}`)
      .then((res) => res.json())
      .then(setRateLimits)
      .catch(() => setRateLimits(null));
    fetch('/api/insights/rate-limit-incidents?windowMinutes=30')
      .then((res) => res.json())
      .then((data) => setRateLimitIncidents(Array.isArray(data?.incidents) ? data.incidents : []))
      .catch(() => setRateLimitIncidents([]));
  }, [activePane, providerId]);

  useEffect(() => {
    if (activePane !== 'model') return;
    const params = new URLSearchParams({ providerId, model, region });
    fetch(`/api/insights/throughput-baseline?${params.toString()}`)
      .then((res) => res.json())
      .then(setThroughputBaseline)
      .catch(() => setThroughputBaseline(null));
  }, [activePane, providerId, model, region]);

  useEffect(() => {
    if (activePane !== 'radar') return;
    fetch(`/api/insights/change-radar?providerId=${providerId}`)
      .then((res) => res.json())
      .then(setRadar)
      .catch(() => setRadar([]));
  }, [activePane, providerId]);

  useEffect(() => {
    if (activePane !== 'behavioral' && activePane !== 'model') return;
    fetch(`/api/insights/behavioral?providerId=${providerId}`)
      .then((res) => res.json())
      .then(setBehavioral)
      .catch(() => setBehavioral(null));
  }, [activePane, providerId]);

  const endpoints = catalog.endpoints || [];
  const regions = catalog.regions || [];
  const models = catalog.models || [];

  const tilesByEndpoint = useMemo<Record<string, ModelMatrixTile[]>>(() => {
    if (!matrix) return {};
    return matrix.tiles.reduce((acc, tile) => {
      acc[tile.endpoint] = acc[tile.endpoint] || [];
      acc[tile.endpoint].push(tile);
      return acc;
    }, {} as Record<string, ModelMatrixTile[]>);
  }, [matrix]);

  const selectedEndpointTiles = tilesByEndpoint[endpoint] || [];
  const observedRegions = Array.from(new Set(selectedEndpointTiles.map((tile) => tile.region)));
  const observedModels = Array.from(new Set(selectedEndpointTiles.map((tile) => tile.model)));
  const regionOrder = observedRegions.length ? observedRegions : regions;
  const modelOrder = observedModels.length ? observedModels : models.map((item) => item.id);

  const handleTileClick = async (tile: any) => {
    const response = await fetch('/api/insights/fallback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tile),
    });
    if (response.ok) {
      const data = await response.json();
      setFallbackPlan(data);
    }
  };

  const handleAsk = async () => {
    const response = await fetch('/api/insights/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: askQuestion, providerId }),
    });
    if (response.ok) {
      const data = await response.json();
      setAskResponse(data);
    }
  };

  const handleRadarCreate = async () => {
    setRadarStatus('');
    if (!radarSecret) {
      setRadarStatus('Admin secret required.');
      return;
    }
    if (!radarTitle.trim() || !radarSummary.trim()) {
      setRadarStatus('Title and summary are required.');
      return;
    }
    const response = await fetch('/api/insights/change-radar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': radarSecret,
      },
      body: JSON.stringify({
        providerId,
        type: radarType,
        title: radarTitle.trim(),
        summary: radarSummary.trim(),
        effectiveDate: radarEffectiveDate || undefined,
        url: radarUrl || undefined,
        severity: radarSeverity,
      }),
    });
    if (response.ok) {
      const created = await response.json();
      setRadar((prev) => [created, ...prev]);
      setRadarTitle('');
      setRadarSummary('');
      setRadarEffectiveDate('');
      setRadarUrl('');
      setRadarStatus('Event published.');
    } else {
      setRadarStatus('Failed to publish event.');
    }
  };

  const handleRadarDelete = async (eventId: string) => {
    if (!radarSecret) {
      setRadarStatus('Admin secret required.');
      return;
    }
    const response = await fetch(`/api/insights/change-radar/${eventId}`, {
      method: 'DELETE',
      headers: { 'x-admin-secret': radarSecret },
    });
    if (response.ok) {
      setRadar((prev) => prev.filter((event) => event.id !== eventId));
    } else {
      setRadarStatus('Failed to delete event.');
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface-card-strong p-6" data-tour="reliability-intro">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Reliability Lab</p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mt-2">
          Deep diagnostics for AI workloads
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          Combine synthetic probes, crowd telemetry, and your account signal to predict incidents and
          generate fallback playbooks.
        </p>
      </section>

      <div className="surface-card p-3 flex flex-wrap items-center gap-3 justify-between" data-tour="reliability-panes">
        <div className="flex flex-wrap gap-2">
          {PANES.map((pane) => (
            <button
              key={pane.id}
              onClick={() => setActivePane(pane.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                activePane === pane.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {pane.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={providerId}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-xs"
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.displayName || provider.name}
              </option>
            ))}
          </select>
          <select
            value={model}
            onChange={(e) => {
              const nextModel = e.target.value;
              setModel(nextModel);
              const match = models.find((entry) => entry.id === nextModel);
              setTier(match?.tier || catalog.tiers?.[0] || 'unknown');
              setStreaming(Boolean(match?.streaming));
            }}
            className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-xs"
          >
            {models.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.id}
              </option>
            ))}
          </select>
          <select
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-xs"
          >
            {endpoints.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-xs"
          >
            {regions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-xs"
          >
            {(catalog.tiers || ['unknown']).map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <button
            onClick={() => setStreaming((prev) => !prev)}
            className={`px-3 py-2 rounded-full text-xs font-semibold border transition ${
              streaming
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                : 'border-slate-200/70 dark:border-slate-700/70 text-slate-500 dark:text-slate-300'
            }`}
          >
            {streaming ? 'Streaming on' : 'Streaming off'}
          </button>
        </div>
      </div>

      {activePane === 'canary' && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]" data-tour="reliability-canary">
          <div className="surface-card-strong p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Canary Copilot</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Compare official status, observed global telemetry, and your account lens side-by-side.
            </p>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {model} | {endpoint} | {region} | {tier} | {streaming ? 'streaming' : 'non-streaming'}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[canary?.lenses.official, canary?.lenses.observed, canary?.lenses.account].map((lens, index) => (
                <div key={index} className="surface-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {lens?.label || 'No data'}
                  </p>
                  <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs ${signalClass(lens?.signal || 'no-data')}`}>
                    {lens?.signal || 'no-data'}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
                    {lens?.summary || 'No telemetry collected yet.'}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[canary?.lenses.synthetic, canary?.lenses.crowd].map((lens, index) => (
                <div key={index} className="surface-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {lens?.label || 'No data'}
                  </p>
                  <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs ${signalClass(lens?.signal || 'no-data')}`}>
                    {lens?.signal || 'no-data'}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
                    {lens?.summary || 'No telemetry collected yet.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="surface-card-strong p-6">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Account lens</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Provide your account token to isolate your application telemetry.
            </p>
            <input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="account-id"
              className="mt-3 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
            />
            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Metrics update once your SDK streams telemetry events.
            </div>
            <div className="mt-4 surface-card p-3 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-700 dark:text-slate-200">SDK quickstart</p>
              <pre className="mt-2 bg-slate-900 text-slate-100 rounded-xl p-3 overflow-auto text-[11px]">
{`<script src="/sdk/ai-status-sdk.js"></script>
<script>
  AIStatusSDK.configure({
    telemetryKey: "YOUR_TELEMETRY_KEY",
    clientId: "your-client-id",
    providerId: "${providerId}",
    model: "${model}",
    endpoint: "${endpoint}",
    region: "${region}",
    tier: "${tier}"
  });
  AIStatusSDK.report({ latencyMs: 120, http429Rate: 0.02 });
</script>`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {activePane === 'model' && (
        <div className="surface-card-strong p-6 space-y-5" data-tour="reliability-model">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Model detail</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {providerId} · {model} · {endpoint} · {region} · {tier}{streaming ? ' · streaming' : ''}
            </p>
          </div>
          {canary ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {[canary.lenses.official, canary.lenses.observed, canary.lenses.account].map((lens, index) => (
                  <div key={index} className="surface-card p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{lens?.label || 'No data'}</p>
                    <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs ${signalClass(lens?.signal || 'no-data')}`}>
                      {lens?.signal || 'no-data'}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
                      {lens?.summary || 'No telemetry collected yet.'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[canary.lenses.synthetic, canary.lenses.crowd].map((lens, index) => (
                  <div key={index} className="surface-card p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{lens.label}</p>
                    <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs ${signalClass(lens.signal)}`}>
                      {lens.signal}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
                      {lens.summary}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500 dark:text-slate-400">No canary signal yet.</div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="surface-card p-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Rate limits</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {(rateLimits?.segments || [])
                  .filter((segment) => segment.model === model && segment.region === region)
                  .map((segment, idx) => (
                    <div key={idx} className="surface-card p-3 flex items-center justify-between">
                      <span>429 {(segment.http429Rate * 100).toFixed(1)}%</span>
                      <span>tps {segment.effectiveTokensPerSec ? Math.round(segment.effectiveTokensPerSec) : 'n/a'}</span>
                    </div>
                  ))}
                {(!rateLimits || rateLimits.segments.length === 0) && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    No rate-limit telemetry yet.
                  </div>
                )}
              </div>
            </div>
            <div className="surface-card p-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Behavioral stability</h4>
              <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {(behavioral?.segments || [])
                  .filter((segment) => segment.model === model && segment.region === region)
                  .map((segment, idx) => (
                    <div key={idx} className="surface-card p-3">
                      <div>Refusal {segment.refusalRate !== undefined ? `${(segment.refusalRate * 100).toFixed(1)}%` : 'n/a'}</div>
                      <div>Tool {segment.toolSuccessRate !== undefined ? `${(segment.toolSuccessRate * 100).toFixed(1)}%` : 'n/a'}</div>
                      <div>Schema {segment.schemaValidRate !== undefined ? `${(segment.schemaValidRate * 100).toFixed(1)}%` : 'n/a'}</div>
                    </div>
                  ))}
                {(!behavioral || behavioral.segments.length === 0) && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    No behavioral metrics yet.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="surface-card p-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Throughput baseline</h4>
            {throughputBaseline?.currentTokensPerSec !== undefined ? (
              <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Current: {Math.round(throughputBaseline.currentTokensPerSec)} tps · Baseline:{' '}
                {throughputBaseline.baselineTokensPerSec ? Math.round(throughputBaseline.baselineTokensPerSec) : 'n/a'} tps
                {throughputBaseline.delta !== undefined && (
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    ({(throughputBaseline.delta * 100).toFixed(1)}% vs baseline)
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                No throughput baseline yet.
              </div>
            )}
          </div>
        </div>
      )}

      {activePane === 'matrix' && (
        <div className="grid gap-6 lg:grid-cols-[1.3fr,0.7fr]" data-tour="reliability-matrix">
          <div className="surface-card-strong p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Model Matrix</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  Heatmap across models, regions, and endpoints. Click a tile for fallback guidance.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {selectedEndpointTiles.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No telemetry collected yet for this endpoint.
                </div>
              ) : (
                <div className="grid gap-3">
                  {modelOrder.map((modelId) => (
                    <div key={modelId} className="grid grid-cols-[140px_repeat(auto-fit,minmax(120px,1fr))] gap-2 items-center">
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{modelId}</div>
                      {regionOrder.map((regionId) => {
                        const tile = selectedEndpointTiles.find(
                          (t) => t.model === modelId && t.region === regionId
                        );
                        return (
                          <button
                            key={`${modelId}-${regionId}`}
                            onClick={() => tile && handleTileClick(tile)}
                            className={`rounded-xl p-3 text-left border border-slate-200/70 dark:border-slate-700/70 ${signalClass(tile?.signal || 'no-data')}`}
                          >
                            <div className="text-xs uppercase tracking-[0.2em]">{regionId}</div>
                            <div className="text-sm font-semibold mt-2">
                              {tile?.latencyP95 ? `${Math.round(tile.latencyP95)}ms` : 'No data'}
                            </div>
                            <div className="text-xs mt-1">
                              p50 {tile?.latencyP50 ? Math.round(tile.latencyP50) : 'n/a'} | p99 {tile?.latencyP99 ? Math.round(tile.latencyP99) : 'n/a'}
                            </div>
                            <div className="text-xs mt-1">
                              5xx {tile?.http5xxRate ? `${(tile.http5xxRate * 100).toFixed(1)}%` : 'n/a'} | 429 {tile?.http429Rate ? `${(tile.http429Rate * 100).toFixed(1)}%` : 'n/a'}
                            </div>
                            <div className="text-xs mt-1">
                              tps {tile?.tokensPerSec ? Math.round(tile.tokensPerSec) : 'n/a'} | stream {tile?.streamDisconnectRate ? `${(tile.streamDisconnectRate * 100).toFixed(1)}%` : 'n/a'}
                            </div>
                            <div className="text-[10px] mt-2 uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                              Confidence {tile?.confidence || 'low'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="surface-card-strong p-6">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Fallback recipe</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Generated when you click a degraded tile.
            </p>
            {fallbackPlan ? (
              <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <p className="font-semibold">{fallbackPlan.summary}</p>
                {fallbackPlan.evidence && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Evidence: {fallbackPlan.evidence.snapshot} · samples {fallbackPlan.evidence.sampleCount}
                  </div>
                )}
                <ul className="space-y-2">
                  {fallbackPlan.actions.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-400 mt-2" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
                <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-3 overflow-auto">
{JSON.stringify(fallbackPlan.jsonPolicy, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Click a tile to generate a routing plan.
              </div>
            )}
          </div>
        </div>
      )}

      {activePane === 'replay' && (
        <div className="surface-card-strong p-6" data-tour="reliability-replay">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Incident Replay</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Scrub through historical incidents and see how status evolved.
          </p>
          {replay && replay.timeline.length ? (
            <div className="mt-4 space-y-4">
              <div className="surface-card p-4">
                <input
                  type="range"
                  min={0}
                  max={Math.max(replay.timeline.length - 1, 0)}
                  value={replayIndex}
                  onChange={(e) => setReplayIndex(Number(e.target.value))}
                  className="w-full"
                />
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Selected point:{' '}
                  <ClientTimestamp
                    format="datetime"
                    date={new Date(replay.timeline[replayIndex].timestamp)}
                  />
                </div>
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  Status: {replay.timeline[replayIndex].status} | Latency:{' '}
                  {replay.timeline[replayIndex].latencyP95
                    ? `${Math.round(replay.timeline[replayIndex].latencyP95 || 0)}ms`
                    : 'n/a'}
                </div>
              </div>
              <div className="surface-card p-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">What-if simulation</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Estimate failover timing using your current routing rules.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">p95 threshold (ms)</label>
                    <input
                      value={failoverThreshold}
                      onChange={(e) => setFailoverThreshold(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Fallback target</label>
                    <input
                      value={failoverTarget}
                      onChange={(e) => setFailoverTarget(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                    />
                  </div>
                </div>
                {(() => {
                  const threshold = Number(failoverThreshold) || 2000;
                  const breachIndex = replay.timeline.findIndex(
                    (point) => (point.latencyP95 || 0) > threshold || point.status !== 'operational'
                  );
                  if (breachIndex === -1) {
                    return (
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                        No failover would have been triggered in this window.
                      </p>
                    );
                  }
                  return (
                    <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                      Failover to {failoverTarget} at{' '}
                      <ClientTimestamp
                        format="datetime"
                        date={new Date(replay.timeline[breachIndex].timestamp)}
                      />
                      .
                    </p>
                  );
                })()}
              </div>
              <div className="space-y-3">
                {replay.timeline.slice(-12).map((point) => (
                  <div key={point.timestamp} className="surface-card p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500">
                        <ClientTimestamp format="datetime" date={new Date(point.timestamp)} />
                      </div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{point.status}</div>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {point.latencyP95 ? `${Math.round(point.latencyP95)}ms` : 'n/a'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">No replay data yet.</div>
          )}
        </div>
      )}

      {activePane === 'forecast' && (
        <div className="surface-card-strong p-6" data-tour="reliability-forecast">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Reliability Forecast</h3>
          {forecast ? (
            <div className="mt-4 space-y-3">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${signalClass(forecast.risk)}`}>
                {forecast.risk}
              </div>
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                {forecast.rationale.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">No forecast available.</div>
          )}
        </div>
      )}

      {activePane === 'rate' && (
        <div className="surface-card-strong p-6" data-tour="reliability-rate">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Rate-limit transparency</h3>
          <div className="mt-4 surface-card p-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Rate-limit incidents</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Elevated 429 spikes detected across crowd telemetry.
            </p>
            <div className="mt-3 space-y-2">
              {rateLimitIncidents.length === 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  No rate-limit incidents detected in the last 30 minutes.
                </div>
              )}
              {rateLimitIncidents.map((incident) => (
                <div key={incident.id} className="surface-card p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {incident.providerId}
                    </div>
                    <div className="text-xs text-slate-500">
                      {incident.model} · {incident.region}
                    </div>
                  </div>
                  <div className="text-sm text-rose-600 dark:text-rose-300">
                    429 {(incident.http429Rate * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
          {rateLimits && rateLimits.segments.length ? (
            <div className="mt-4 space-y-2">
              {rateLimits.segments.map((segment, idx) => (
                <div key={idx} className="surface-card p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{segment.model}</div>
                    <div className="text-xs text-slate-500">{segment.region} | {segment.tier}</div>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    429 {(segment.http429Rate * 100).toFixed(1)}% | tps {segment.effectiveTokensPerSec ? Math.round(segment.effectiveTokensPerSec) : 'n/a'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Retry-after p50 {segment.retryAfterP50 ? Math.round(segment.retryAfterP50) : 'n/a'}ms | p95 {segment.retryAfterP95 ? Math.round(segment.retryAfterP95) : 'n/a'}ms
                  </div>
                  {segment.topReasons && segment.topReasons.length > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Reasons: {segment.topReasons.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">No rate-limit telemetry yet.</div>
          )}
        </div>
      )}

      {activePane === 'radar' && (
        <div className="surface-card-strong p-6" data-tour="reliability-radar">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Pricing + capacity radar</h3>
          <div className="mt-4 surface-card p-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Budget guardrails</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Store alerts locally for now. Wire to real billing feeds when ready.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Monthly budget (USD)</label>
                <input
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  placeholder="5000"
                  className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Alert threshold (0.10 = 10%)</label>
                <input
                  value={budgetThreshold}
                  onChange={(e) => setBudgetThreshold(e.target.value)}
                  placeholder="0.15"
                  className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 surface-card p-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Admin: publish change event</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Requires admin secret. Stored locally in this browser.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Admin secret</label>
                <input
                  value={radarSecret}
                  onChange={(e) => setRadarSecret(e.target.value)}
                  placeholder="CHANGE_RADAR_SECRET"
                  className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Type</label>
                <select
                  value={radarType}
                  onChange={(e) => setRadarType(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                >
                  <option value="pricing">Pricing</option>
                  <option value="quota">Quota</option>
                  <option value="deprecation">Deprecation</option>
                  <option value="migration">Migration</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Severity</label>
                <select
                  value={radarSeverity}
                  onChange={(e) => setRadarSeverity(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                >
                  <option value="info">Info</option>
                  <option value="important">Important</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400">Effective date</label>
                <input
                  value={radarEffectiveDate}
                  onChange={(e) => setRadarEffectiveDate(e.target.value)}
                  placeholder="2025-03-01"
                  className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">Title</label>
                <input
                  value={radarTitle}
                  onChange={(e) => setRadarTitle(e.target.value)}
                  placeholder="Pricing update for GPT-4o"
                  className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">Summary</label>
                <textarea
                  value={radarSummary}
                  onChange={(e) => setRadarSummary(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">Reference URL</label>
                <input
                  value={radarUrl}
                  onChange={(e) => setRadarUrl(e.target.value)}
                  placeholder="https://provider.com/updates"
                  className="mt-1 w-full px-3 py-2 rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={handleRadarCreate} className="cta-primary">
                Publish change event
              </button>
              {radarStatus && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{radarStatus}</span>
              )}
            </div>
          </div>
          {radar.length ? (
            <div className="mt-4 space-y-3">
              {radar.map((event) => (
                <div key={event.id} className="surface-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{event.title}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-[0.2em]">
                      <span>{event.type}</span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500">
                        {event.severity}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{event.summary}</p>
                  {event.effectiveDate && (
                    <p className="text-xs text-slate-400 mt-1">Effective: {event.effectiveDate}</p>
                  )}
                  {event.url && (
                    <a
                      className="text-xs text-blue-600 dark:text-blue-300 mt-1 inline-block"
                      href={event.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Reference link
                    </a>
                  )}
                  {radarSecret && (
                    <div className="mt-3">
                      <button
                        onClick={() => handleRadarDelete(event.id)}
                        className="text-xs text-rose-600 dark:text-rose-300"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">No change events yet.</div>
          )}
        </div>
      )}

      {activePane === 'behavioral' && (
        <div className="surface-card-strong p-6" data-tour="reliability-behavioral">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Behavioral stability</h3>
          {behavioral && behavioral.segments.length ? (
            <div className="mt-4 space-y-2">
              {behavioral.segments.map((segment, idx) => (
                <div key={idx} className="surface-card p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{segment.model}</div>
                    <div className="text-xs text-slate-500">{segment.endpoint} | {segment.region}</div>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Refusal {segment.refusalRate !== undefined ? `${(segment.refusalRate * 100).toFixed(1)}%` : 'n/a'} | Tool {segment.toolSuccessRate !== undefined ? `${(segment.toolSuccessRate * 100).toFixed(1)}%` : 'n/a'} | JSON {segment.schemaValidRate !== undefined ? `${(segment.schemaValidRate * 100).toFixed(1)}%` : 'n/a'} | Len {segment.completionLength ? Math.round(segment.completionLength) : 'n/a'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">No behavioral metrics yet.</div>
          )}
        </div>
      )}

      {activePane === 'ask' && (
        <div className="surface-card-strong p-6" data-tour="reliability-ask">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Ask Status</h3>
          <div className="mt-4 space-y-3">
            <textarea
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-sm"
              rows={3}
            />
            <button onClick={handleAsk} className="cta-primary">
              Ask
            </button>
            {askResponse && (
              <div className="surface-card p-4">
                <p className="text-sm text-slate-700 dark:text-slate-200">{askResponse.answer}</p>
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Window: {askResponse.receipts.windowMinutes}m | Sources: {askResponse.receipts.dataSources.join(', ')}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Snapshot: {askResponse.receipts.snapshot}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
