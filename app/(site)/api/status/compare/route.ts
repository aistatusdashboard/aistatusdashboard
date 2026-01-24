import { NextRequest, NextResponse } from 'next/server';
import { providerService } from '@/lib/services/providers';
import { persistenceService } from '@/lib/services/persistence';
import type { ProviderStatus } from '@/lib/types';

type ProviderMetric = {
  providerId: string;
  providerName: string;
  totalChecks: number;
  operationalChecks: number;
  degradedChecks: number;
  downChecks: number;
  incidentChecks: number;
  avgResponseTime: number | null;
  uptime: number | null;
  lastIncidentAt: string | null;
};

const MAX_LIMIT = 5000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const windowDaysRaw = parseInt(searchParams.get('days') || '7', 10);
    const windowDays = Number.isFinite(windowDaysRaw) && windowDaysRaw > 0 ? windowDaysRaw : 7;
    const limitRaw = parseInt(searchParams.get('limit') || '2000', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 100), MAX_LIMIT) : 2000;

    const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const history = await persistenceService.getHistory({ startDate, limit });

    const providers = providerService.getProviders();
    const metrics = new Map<string, ProviderMetric>();

    providers.forEach((provider) => {
      metrics.set(provider.id, {
        providerId: provider.id,
        providerName: provider.displayName || provider.name,
        totalChecks: 0,
        operationalChecks: 0,
        degradedChecks: 0,
        downChecks: 0,
        incidentChecks: 0,
        avgResponseTime: null,
        uptime: null,
        lastIncidentAt: null,
      });
    });

    const responseSums = new Map<string, number>();

    history.forEach((record) => {
      const entry =
        metrics.get(record.id) ||
        {
          providerId: record.id,
          providerName: record.name || record.id,
          totalChecks: 0,
          operationalChecks: 0,
          degradedChecks: 0,
          downChecks: 0,
          incidentChecks: 0,
          avgResponseTime: null,
          uptime: null,
          lastIncidentAt: null,
        };

      entry.totalChecks += 1;
      const status = record.status as ProviderStatus;
      if (status === 'operational') entry.operationalChecks += 1;
      if (status === 'degraded' || status === 'partial_outage') entry.degradedChecks += 1;
      if (status === 'down' || status === 'major_outage') entry.downChecks += 1;
      if (status !== 'operational') {
        entry.incidentChecks += 1;
        if (!entry.lastIncidentAt || new Date(record.checkedAt) > new Date(entry.lastIncidentAt)) {
          entry.lastIncidentAt = record.checkedAt;
        }
      }

      const sum = responseSums.get(record.id) || 0;
      responseSums.set(record.id, sum + (record.responseTime || 0));
      metrics.set(record.id, entry);
    });

    metrics.forEach((entry) => {
      if (entry.totalChecks > 0) {
        entry.avgResponseTime = Math.round((responseSums.get(entry.providerId) || 0) / entry.totalChecks);
        entry.uptime = parseFloat(((entry.operationalChecks / entry.totalChecks) * 100).toFixed(2));
      }
    });

    return NextResponse.json({
      windowDays,
      sampleSize: history.length,
      providers: Array.from(metrics.values()),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
