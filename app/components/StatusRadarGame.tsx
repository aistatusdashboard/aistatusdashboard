'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent } from '@/lib/utils/analytics-client';

type StatusTone = 'operational' | 'degraded' | 'down' | 'maintenance' | 'unknown';
type DifficultyKey = 'casual' | 'standard' | 'challenge';

export type RadarProvider = {
  id: string;
  label: string;
  status?: StatusTone;
};

export type IncidentHint = {
  incidentId: string;
  title: string;
  providerId?: string;
};

export interface StatusRadarPulse {
  status: StatusTone;
  incidents24h: number;
  tracking: number;
  recentIncidents: IncidentHint[];
}

interface StatusRadarGameProps {
  providers: RadarProvider[];
  pulse: StatusRadarPulse;
}

type RadarTarget = {
  id: string;
  providerId: string;
  label: string;
  status: StatusTone;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRisk: number;
  anomalyUntil: number | null;
  anomalyLevel: number;
};

type DifficultyProfile = {
  label: string;
  spawnMultiplier: number;
  timeoutMinMs: number;
  timeoutMaxMs: number;
  missPenalty: number;
  falsePenalty: number;
  hitBase: number;
  comboBonus: number;
  integrityRecover: number;
  missionTarget: number;
};

type BadgeTier = {
  id: string;
  minCombo: number;
  label: string;
  toneClass: string;
};

const SCORE_STORAGE_KEY = 'status-radar-high-score-v1';
const COMBO_STORAGE_KEY = 'status-radar-best-combo-v1';
const MODE_STORAGE_KEY = 'status-radar-mode-v1';

const DIFFICULTY_PROFILES: Record<DifficultyKey, DifficultyProfile> = {
  casual: {
    label: 'Casual',
    spawnMultiplier: 1.18,
    timeoutMinMs: 6200,
    timeoutMaxMs: 9000,
    missPenalty: 6,
    falsePenalty: 1,
    hitBase: 16,
    comboBonus: 2,
    integrityRecover: 3,
    missionTarget: 180,
  },
  standard: {
    label: 'Standard',
    spawnMultiplier: 1,
    timeoutMinMs: 5000,
    timeoutMaxMs: 7600,
    missPenalty: 8,
    falsePenalty: 2,
    hitBase: 14,
    comboBonus: 3,
    integrityRecover: 2,
    missionTarget: 260,
  },
  challenge: {
    label: 'Challenge',
    spawnMultiplier: 0.82,
    timeoutMinMs: 4100,
    timeoutMaxMs: 6300,
    missPenalty: 10,
    falsePenalty: 3,
    hitBase: 12,
    comboBonus: 4,
    integrityRecover: 1,
    missionTarget: 340,
  },
};

const STREAK_BADGES: BadgeTier[] = [
  {
    id: 'warmup',
    minCombo: 0,
    label: 'Warmup',
    toneClass: 'text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80',
  },
  {
    id: 'scout',
    minCombo: 3,
    label: 'Signal Scout',
    toneClass: 'text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-500/35',
  },
  {
    id: 'ranger',
    minCombo: 6,
    label: 'Uptime Ranger',
    toneClass: 'text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-500/35',
  },
  {
    id: 'guardian',
    minCombo: 10,
    label: 'Guardian Prime',
    toneClass: 'text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-500/35',
  },
];

const STATUS_BASE_RISK: Record<StatusTone, number> = {
  operational: 0.2,
  degraded: 0.56,
  down: 0.78,
  maintenance: 0.42,
  unknown: 0.34,
};

const STATUS_DOT: Record<StatusTone, string> = {
  operational: 'bg-emerald-400 border-emerald-200/90',
  degraded: 'bg-amber-400 border-amber-200/90',
  down: 'bg-rose-400 border-rose-200/90',
  maintenance: 'bg-sky-400 border-sky-200/90',
  unknown: 'bg-slate-400 border-slate-200/90',
};

function createPrng(seed: number) {
  let value = Math.floor(seed) % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function toStatusTone(status?: string): StatusTone {
  if (status === 'operational') return 'operational';
  if (status === 'degraded') return 'degraded';
  if (status === 'down') return 'down';
  if (status === 'maintenance') return 'maintenance';
  return 'unknown';
}

function escalateStatus(status: StatusTone): StatusTone {
  if (status === 'operational') return 'degraded';
  if (status === 'maintenance' || status === 'unknown' || status === 'degraded') return 'down';
  return 'down';
}

function calmStatus(status: StatusTone): StatusTone {
  if (status === 'down') return 'degraded';
  if (status === 'degraded') return 'operational';
  return status;
}

function pickWeightedTarget(targets: RadarTarget[], random: () => number) {
  const activeTargets = targets.filter((target) => target.anomalyUntil === null);
  if (activeTargets.length === 0) return -1;

  const total = activeTargets.reduce((acc, target) => acc + target.baseRisk, 0);
  let threshold = random() * total;

  for (const target of activeTargets) {
    threshold -= target.baseRisk;
    if (threshold <= 0) {
      return targets.findIndex((entry) => entry.id === target.id);
    }
  }

  return targets.findIndex((entry) => entry.id === activeTargets[activeTargets.length - 1].id);
}

function computeSeed(providers: RadarProvider[], pulse: StatusRadarPulse) {
  return (
    providers.length * 97 +
    pulse.tracking * 13 +
    pulse.incidents24h * 29 +
    pulse.recentIncidents.reduce(
      (acc, incident) => acc + incident.title.length + (incident.providerId?.length || 0),
      0
    )
  );
}

function getBadgeForCombo(combo: number): BadgeTier {
  for (let index = STREAK_BADGES.length - 1; index >= 0; index -= 1) {
    const tier = STREAK_BADGES[index];
    if (combo >= tier.minCombo) {
      return tier;
    }
  }
  return STREAK_BADGES[0];
}

function buildTargets(
  providers: RadarProvider[],
  pulse: StatusRadarGameProps['pulse'],
  seed: number
): RadarTarget[] {
  const random = createPrng(seed + pulse.incidents24h * 97);
  const source =
    providers.length > 0
      ? providers
      : [{ id: 'network-core', label: 'Network core', status: 'unknown' as StatusTone }];
  const incidentProviders = new Set(
    pulse.recentIncidents
      .map((incident) => incident.providerId)
      .filter((value): value is string => Boolean(value))
  );
  const selection = [...source]
    .sort(() => random() - 0.5)
    .slice(0, Math.min(14, Math.max(8, source.length)));

  const positions: Array<{ x: number; y: number }> = [];
  return selection.map((provider, index) => {
    let x = 50;
    let y = 50;
    for (let attempt = 0; attempt < 22; attempt += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 42;
      const nextX = 50 + Math.cos(angle) * radius;
      const nextY = 50 + Math.sin(angle) * radius;
      const isFarEnough = positions.every((point) => {
        const dx = point.x - nextX;
        const dy = point.y - nextY;
        return Math.sqrt(dx * dx + dy * dy) > 9;
      });
      x = nextX;
      y = nextY;
      if (isFarEnough) break;
    }
    positions.push({ x, y });

    const hasIncident = incidentProviders.has(provider.id);
    const fallbackStatus = hasIncident ? (pulse.status === 'down' ? 'down' : 'degraded') : 'operational';
    const status = toStatusTone(provider.status || fallbackStatus);
    const speed = 0.18 + random() * 0.25;
    const heading = random() * Math.PI * 2;
    const baseRisk = Math.min(0.95, STATUS_BASE_RISK[status] + random() * 0.22);

    return {
      id: `${provider.id}-${index}`,
      providerId: provider.id,
      label: provider.label,
      status,
      x,
      y,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      baseRisk,
      anomalyUntil: null,
      anomalyLevel: 0,
    };
  });
}

export default function StatusRadarGame({ providers, pulse }: StatusRadarGameProps) {
  const initialSeed = useMemo(() => computeSeed(providers, pulse), [providers, pulse]);
  const recommendedDifficulty = useMemo(() => {
    if (pulse.incidents24h >= 12) return 'challenge' as const;
    if (pulse.status === 'down') return 'standard' as const;
    if (pulse.status === 'degraded' || pulse.incidents24h >= 6) return 'standard' as const;
    return 'casual' as const;
  }, [pulse.incidents24h, pulse.status]);
  const [targets, setTargets] = useState<RadarTarget[]>(() => buildTargets(providers, pulse, initialSeed));
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [integrity, setIntegrity] = useState(100);
  const [paused, setPaused] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyKey>(recommendedDifficulty);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState('');
  const [botMessage, setBotMessage] = useState(
    pulse.status === 'operational'
      ? 'No critical anomalies. Keep a light scan running.'
      : 'Signal turbulence detected. Ready to intercept hot spots.'
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const comboRef = useRef(0);
  const integrityRef = useRef(100);
  const lastSpawnRef = useRef(0);
  const difficultyTouchedRef = useRef(false);
  const unlockedBadgeRef = useRef('');
  const missionCompletedRef = useRef(false);
  const difficultyProfile = DIFFICULTY_PROFILES[difficulty];

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(mediaQuery.matches);
    updateMotion();
    mediaQuery.addEventListener('change', updateMotion);
    return () => mediaQuery.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    try {
      const storedScore = Number(window.localStorage.getItem(SCORE_STORAGE_KEY));
      if (Number.isFinite(storedScore) && storedScore > 0) {
        setHighScore(Math.floor(storedScore));
      }
      const storedCombo = Number(window.localStorage.getItem(COMBO_STORAGE_KEY));
      if (Number.isFinite(storedCombo) && storedCombo > 0) {
        setBestCombo(Math.floor(storedCombo));
      }
      const storedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (storedMode === 'casual' || storedMode === 'standard' || storedMode === 'challenge') {
        setDifficulty(storedMode);
        difficultyTouchedRef.current = true;
      }
    } catch {
      // Ignore localStorage failures.
    }
  }, []);

  useEffect(() => {
    if (!difficultyTouchedRef.current) {
      setDifficulty(recommendedDifficulty);
    }
  }, [recommendedDifficulty]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    const badge = getBadgeForCombo(combo);
    if (badge.id !== unlockedBadgeRef.current && badge.minCombo > 0) {
      unlockedBadgeRef.current = badge.id;
      setBotMessage(`${badge.label} unlocked at ${combo}x streak.`);
      trackEvent('status_radar_badge_unlock', {
        metadata: { badge: badge.id, combo, difficulty },
      });
    }
    if (combo === 0) {
      unlockedBadgeRef.current = '';
    }
  }, [combo, difficulty]);

  useEffect(() => {
    if (score >= difficultyProfile.missionTarget && !missionCompletedRef.current) {
      missionCompletedRef.current = true;
      setBotMessage(`Objective complete. ${difficultyProfile.label} mission cleared at ${score} points.`);
      trackEvent('status_radar_mission_complete', {
        metadata: {
          difficulty,
          score,
          target: difficultyProfile.missionTarget,
          bestCombo,
        },
      });
    }
  }, [bestCombo, difficulty, difficultyProfile.label, difficultyProfile.missionTarget, score]);

  useEffect(() => {
    if (score <= highScore) return;
    setHighScore(score);
    try {
      window.localStorage.setItem(SCORE_STORAGE_KEY, String(score));
    } catch {
      // Ignore localStorage failures.
    }
  }, [highScore, score]);

  useEffect(() => {
    if (combo <= bestCombo) return;
    setBestCombo(combo);
    try {
      window.localStorage.setItem(COMBO_STORAGE_KEY, String(combo));
    } catch {
      // Ignore localStorage failures.
    }
  }, [bestCombo, combo]);

  useEffect(() => {
    integrityRef.current = integrity;
    if (integrity <= 0) {
      setPaused(true);
      setBotMessage('Scanner overload. Reinitialize to continue status sweep.');
    }
  }, [integrity]);

  useEffect(() => {
    const seed = Date.now() + Math.floor(Math.random() * 1000);
    setTargets(buildTargets(providers, pulse, seed));
    setNowMs(seed);
    lastSpawnRef.current = seed;
    unlockedBadgeRef.current = '';
  }, [providers, pulse]);

  const spawnDelayMs = useMemo(() => {
    const base =
      pulse.status === 'down'
        ? 1900
        : pulse.status === 'degraded'
          ? 2250
          : pulse.status === 'maintenance'
            ? 2550
            : 3000;
    const pressureReduction = Math.min(pulse.incidents24h * 38, 1050);
    return Math.max(980, Math.round((base - pressureReduction) * difficultyProfile.spawnMultiplier));
  }, [difficultyProfile.spawnMultiplier, pulse.status, pulse.incidents24h]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (paused || integrityRef.current <= 0) return;

      const now = Date.now();
      setNowMs(now);
      const random = createPrng(now + comboRef.current * 37 + pulse.incidents24h * 17);
      let misses = 0;
      let spawned: string | null = null;

      setTargets((prev) => {
        const drift = reducedMotion ? 0 : 1;
        const next = prev.map((target) => {
          let x = target.x + target.vx * drift;
          let y = target.y + target.vy * drift;
          let vx = target.vx;
          let vy = target.vy;

          if (x < 7 || x > 93) {
            vx *= -1;
            x = Math.min(93, Math.max(7, x));
          }
          if (y < 7 || y > 93) {
            vy *= -1;
            y = Math.min(93, Math.max(7, y));
          }

          if (target.anomalyUntil !== null && target.anomalyUntil <= now) {
            misses += 1;
            return {
              ...target,
              x,
              y,
              vx,
              vy,
              anomalyUntil: null,
              anomalyLevel: 0,
              status: escalateStatus(target.status),
              baseRisk: Math.min(0.98, target.baseRisk + 0.07),
            };
          }

          return { ...target, x, y, vx, vy };
        });

        if (now - lastSpawnRef.current >= spawnDelayMs) {
          const index = pickWeightedTarget(next, random);
          if (index >= 0) {
            const level = 1 + Math.floor(random() * 3);
            const timeoutRange = difficultyProfile.timeoutMaxMs - difficultyProfile.timeoutMinMs;
            next[index] = {
              ...next[index],
              anomalyUntil: now + difficultyProfile.timeoutMinMs + Math.floor(random() * timeoutRange),
              anomalyLevel: level,
            };
            spawned = next[index].label;
            lastSpawnRef.current = now;
          }
        }

        return next;
      });

      if (misses > 0) {
        setIntegrity((value) => Math.max(0, value - misses * difficultyProfile.missPenalty));
        setCombo(0);
        setBotMessage(
          misses === 1
            ? 'One anomaly slipped through. Reacquiring signal lock.'
            : `${misses} anomalies slipped through. Integrity dropping.`
        );
      } else if (spawned) {
        setBotMessage(`New anomaly ping near ${spawned}. Tap it before timeout.`);
      }
    }, 300);

    return () => window.clearInterval(timer);
  }, [difficultyProfile, paused, pulse.incidents24h, reducedMotion, spawnDelayMs]);

  const activeTargets = useMemo(
    () =>
      targets
        .filter((target) => target.anomalyUntil !== null && target.anomalyUntil > nowMs)
        .sort((a, b) => (b.anomalyLevel || 0) - (a.anomalyLevel || 0)),
    [nowMs, targets]
  );

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === selectedTargetId) || null,
    [targets, selectedTargetId]
  );
  const streakBadge = useMemo(() => getBadgeForCombo(combo), [combo]);
  const careerBadge = useMemo(() => getBadgeForCombo(bestCombo), [bestCombo]);
  const missionProgress = Math.min(
    100,
    Math.round((Math.max(0, score) / difficultyProfile.missionTarget) * 100)
  );

  const eyeTone = activeTargets.length > 0 || integrity < 45 ? 'bg-rose-400' : 'bg-emerald-400';
  const integrityTone =
    integrity > 70 ? 'text-emerald-700 dark:text-emerald-300' : integrity > 40 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300';

  const onTargetClick = (targetId: string) => {
    if (integrityRef.current <= 0) return;
    setSelectedTargetId(targetId);

    let wasHit = false;
    let providerLabel = '';
    let level = 0;

    setTargets((prev) =>
      prev.map((target) => {
        if (target.id !== targetId) return target;
        providerLabel = target.label;
        if (target.anomalyUntil !== null && target.anomalyUntil > nowMs) {
          wasHit = true;
          level = target.anomalyLevel;
          return {
            ...target,
            anomalyUntil: null,
            anomalyLevel: 0,
            status: calmStatus(target.status),
            baseRisk: Math.max(0.18, target.baseRisk - 0.09),
          };
        }
        return target;
      })
    );

    if (wasHit) {
      const comboBonus = comboRef.current * difficultyProfile.comboBonus;
      setScore((value) => value + difficultyProfile.hitBase + comboBonus + level * 4);
      setCombo((value) => value + 1);
      setIntegrity((value) => Math.min(100, value + difficultyProfile.integrityRecover));
      setBotMessage(`Patch successful at ${providerLabel}. Keep chaining detections.`);
      return;
    }

    setCombo(0);
    setScore((value) => Math.max(0, value - difficultyProfile.falsePenalty));
    setBotMessage(`Quiet signal at ${providerLabel}. Stay focused on red pings.`);
  };

  const handleShareScore = async () => {
    const shareText =
      `I scored ${score} with a ${combo}x streak (${streakBadge.label}) in Status Radar Mission on AI Status Dashboard. ` +
      `Mode: ${difficultyProfile.label}. Tracking ${pulse.tracking} providers. https://aistatusdashboard.com`;

    let method: 'native' | 'clipboard' | 'none' = 'none';
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Status Radar Mission Score',
          text: shareText,
          url: 'https://aistatusdashboard.com',
        });
        method = 'native';
        setShareFeedback('Score shared.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        method = 'clipboard';
        setShareFeedback('Score copied to clipboard.');
      } else {
        setShareFeedback('Sharing is not available in this browser.');
      }
    } catch {
      setShareFeedback('Share canceled.');
    }

    trackEvent('status_radar_share', {
      metadata: {
        method,
        score,
        combo,
        badge: streakBadge.id,
        difficulty,
      },
    });
  };

  const handleDifficultyChange = (nextDifficulty: DifficultyKey) => {
    if (nextDifficulty === difficulty) return;
    const seed = Math.max(
      1,
      nowMs + (score + 1) * 53 + (comboRef.current + 1) * 97 + (integrityRef.current + 1) * 11
    );
    setDifficulty(nextDifficulty);
    difficultyTouchedRef.current = true;
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, nextDifficulty);
    } catch {
      // Ignore localStorage failures.
    }
    trackEvent('status_radar_mode_change', {
      metadata: { from: difficulty, to: nextDifficulty, incidents24h: pulse.incidents24h },
    });
    setBotMessage(`Mode switched to ${DIFFICULTY_PROFILES[nextDifficulty].label}. Scanner recalibrated.`);
    setTargets(buildTargets(providers, pulse, seed));
    setNowMs(seed);
    lastSpawnRef.current = seed;
    setCombo(0);
    setScore(0);
    setIntegrity(100);
    setPaused(false);
    setSelectedTargetId(null);
    setShareFeedback('');
    unlockedBadgeRef.current = '';
    missionCompletedRef.current = false;
  };

  const resetSimulation = () => {
    const seed = Math.max(
      1,
      nowMs + (score + 1) * 67 + (comboRef.current + 1) * 89 + (integrityRef.current + 1) * 13
    );
    setTargets(buildTargets(providers, pulse, seed));
    setScore(0);
    setCombo(0);
    setIntegrity(100);
    setPaused(false);
    setSelectedTargetId(null);
    setBotMessage('Simulation reset. Scanner is online and searching.');
    setNowMs(seed);
    lastSpawnRef.current = seed;
    setShareFeedback('');
    unlockedBadgeRef.current = '';
    missionCompletedRef.current = false;
  };

  useEffect(() => {
    if (!shareFeedback) return;
    const timer = window.setTimeout(() => setShareFeedback(''), 2600);
    return () => window.clearTimeout(timer);
  }, [shareFeedback]);

  return (
    <section className="surface-card-strong relative overflow-hidden p-5 md:p-6 space-y-4">
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.2),_transparent_70%)] pointer-events-none" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] font-semibold text-slate-500 dark:text-slate-400">
            Status Radar Mission
          </p>
          <h3 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white mt-1">
            Hunt anomaly pings in real time
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Click red blips before they timeout and keep scanner integrity high.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/60 p-1">
            {(['casual', 'standard', 'challenge'] as DifficultyKey[]).map((mode) => {
              const isActive = difficulty === mode;
              const label = DIFFICULTY_PROFILES[mode].label;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleDifficultyChange(mode)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={resetSimulation}
            className="rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleShareScore}
            className="rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            Share score
          </button>
        </div>
      </div>
      {shareFeedback ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{shareFeedback}</p>
      ) : null}
      <div className="surface-card p-3 md:p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-500 dark:text-slate-400">
          Objective
        </p>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
          Clear red anomaly pings before timeout. Every miss reduces integrity. Reach{' '}
          <span className="font-semibold">{difficultyProfile.missionTarget}</span> points before integrity hits 0.
        </p>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Mission progress ({difficultyProfile.label})
          </span>
          <span className="tabular-nums">
            {score}/{difficultyProfile.missionTarget}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800/80 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              missionProgress >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
            }`}
            style={{ width: `${missionProgress}%` }}
          />
        </div>
      </div>

      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] items-stretch">
        <div className="surface-card p-4 md:p-5">
          <div className="relative mx-auto w-full max-w-[430px] aspect-square">
            <div className="absolute inset-0 rounded-full border border-emerald-300/40 dark:border-emerald-500/25 bg-[radial-gradient(circle_at_center,_rgba(15,118,110,0.2),_rgba(2,6,23,0.02)_72%)] dark:bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.18),_rgba(15,23,42,0.55)_72%)]" />
            <div className="absolute inset-[9%] rounded-full border border-emerald-300/35 dark:border-emerald-500/20" />
            <div className="absolute inset-[22%] rounded-full border border-emerald-300/30 dark:border-emerald-500/15" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-emerald-400/25 dark:bg-emerald-300/20" />
            <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-emerald-400/25 dark:bg-emerald-300/20" />
            <div
              className={`absolute inset-0 rounded-full pointer-events-none bg-[conic-gradient(from_30deg,_rgba(45,212,191,0.18),_rgba(45,212,191,0.02)_22%,_transparent_55%)] ${!paused && !reducedMotion ? 'animate-[radar-sweep_5.2s_linear_infinite]' : ''}`}
            />

            {targets.map((target) => {
              const isHot = target.anomalyUntil !== null && target.anomalyUntil > nowMs;
              const dotClass = isHot
                ? 'bg-rose-400 border-rose-100'
                : STATUS_DOT[target.status] || STATUS_DOT.unknown;
              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => onTargetClick(target.id)}
                  style={{ left: `${target.x}%`, top: `${target.y}%` }}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 rounded-full"
                  aria-label={`Radar signal ${target.label}, ${target.status}`}
                >
                  <span
                    className={`absolute inset-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full ${isHot ? 'animate-[radar-pulse_1.25s_ease-out_infinite] bg-rose-400/35' : 'bg-emerald-300/10 dark:bg-emerald-400/10'}`}
                  />
                  <span className={`relative block h-2.5 w-2.5 rounded-full border ${dotClass}`} />
                  <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-950/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200 opacity-0 transition group-hover:opacity-100">
                    {target.label}
                  </span>
                </button>
              );
            })}

            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/80 bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.22)]" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="surface-card p-4">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-gradient-to-b from-slate-100 to-white dark:from-slate-800 dark:to-slate-900">
                <span
                  className={`absolute left-3 top-5 h-2.5 w-2.5 rounded-full ${eyeTone} ${!reducedMotion ? 'animate-[bot-blink_3.3s_ease-in-out_infinite]' : ''}`}
                />
                <span
                  className={`absolute right-3 top-5 h-2.5 w-2.5 rounded-full ${eyeTone} ${!reducedMotion ? 'animate-[bot-blink_3.3s_ease-in-out_infinite]' : ''}`}
                />
                <span className="absolute left-1/2 bottom-4 h-1.5 w-8 -translate-x-1/2 rounded-full bg-slate-400/70 dark:bg-slate-500/70" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] font-semibold text-slate-500 dark:text-slate-400">
                  Scanner bot
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{botMessage}</p>
              </div>
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/65 p-2 md:col-span-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Score</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{score}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/65 p-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Combo</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{combo}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/65 p-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Integrity</p>
                <p className={`mt-1 text-lg font-semibold tabular-nums ${integrityTone}`}>{integrity}%</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/75 dark:bg-slate-900/65 p-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Best</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white tabular-nums">{highScore}</p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  integrity > 70 ? 'bg-emerald-500' : integrity > 40 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${integrity}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 font-semibold ${streakBadge.toneClass}`}
              >
                Streak badge: {streakBadge.label}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Career best: {careerBadge.label} ({bestCombo}x)
              </span>
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Live anomaly queue</p>
              <Link
                href="/incidents"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                Open incidents →
              </Link>
            </div>

            {activeTargets.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {activeTargets.slice(0, 4).map((target) => {
                  const secondsLeft = Math.max(
                    0,
                    Math.ceil(((target.anomalyUntil || nowMs) - nowMs) / 1000)
                  );
                  return (
                    <li
                      key={`${target.id}-active`}
                      className="rounded-lg border border-rose-200/70 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/25 px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-slate-900 dark:text-white">{target.label}</span>
                      <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 tabular-nums">
                        {secondsLeft}s
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : pulse.recentIncidents.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {pulse.recentIncidents.slice(0, 3).map((incident) => (
                  <li
                    key={incident.incidentId}
                    className="rounded-lg border border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/50 px-3 py-2"
                  >
                    <span className="font-medium text-slate-900 dark:text-white">{incident.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Quiet sky right now. The bot will spawn synthetic pings to keep this area interactive.
              </p>
            )}
          </div>

          {selectedTarget ? (
            <div className="surface-card p-3 text-xs text-slate-600 dark:text-slate-300">
              Tracking <span className="font-semibold text-slate-900 dark:text-white">{selectedTarget.label}</span>
              {' • '}
              <span className="uppercase">{selectedTarget.status}</span>
              {' • '}
              Scope {pulse.tracking} providers
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
