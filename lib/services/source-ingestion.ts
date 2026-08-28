import sourcesConfig from '@/lib/data/sources.json';
import appsConfig from '@/lib/casual/apps.json';
import { getDb } from '@/lib/db/firestore';
import { pingIndexNow } from '@/lib/utils/indexnow';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const APP_ID_BY_PROVIDER = new Map<string, string>(
  (appsConfig.apps as Array<{ id: string; providerId: string }>).map((app) => [app.providerId, app.id])
);
import type {
  SourceDefinition,
  PlatformType,
  NormalizedProviderSummary,
  NormalizedComponent,
  NormalizedIncident,
  NormalizedMaintenance,
  SourceFetchResult,
} from '@/lib/types/ingestion';
import { detectPlatform } from '@/lib/utils/platform-detect';
import {
  normalizeSeverity,
  parseStatuspageComponents,
  parseStatuspageIncidents,
  parseStatuspageMaintenances,
  parseInstatusSummary,
  parseGoogleCloudIncidents,
  parseRssIncidents,
  parseCachetComponents,
  parseCachetIncidents,
  parseStatusIo,
  parseBetterstackIndex,
} from '@/lib/utils/platform-parsers';
import { parseHtmlResponse, parseMetaStatusResponse } from '@/lib/utils/status-parsers';
import { sourceRegistryService } from '@/lib/services/source-registry';
import { getGcpProductCatalog } from '@/lib/services/gcp-product-catalog';
import { filterGoogleCloudIncidentsForAi, GOOGLE_AI_KEYWORDS } from '@/lib/utils/google-cloud';

// Ingest re-reads every feed in full every 5 minutes, and feeds return their
// whole recent history. Upserting all of it unconditionally rewrote ~1,300
// unchanged documents per run (~390k Firestore writes/day). We remember what
// we last wrote for each document and skip writes whose content is identical.
// A process restart clears this, which simply costs one full write cycle.
const lastWrittenSignatures = new Map<string, string>();
const MAX_TRACKED_SIGNATURES = 20_000;

function hasChangedSinceLastWrite(docId: string, source: unknown): boolean {
  let signature: string;
  try {
    signature = JSON.stringify(source);
  } catch {
    return true; // Unserializable payload: always write.
  }
  if (lastWrittenSignatures.get(docId) === signature) return false;
  if (lastWrittenSignatures.size >= MAX_TRACKED_SIGNATURES) {
    const oldest = lastWrittenSignatures.keys().next().value;
    if (oldest !== undefined) lastWrittenSignatures.delete(oldest);
  }
  lastWrittenSignatures.set(docId, signature);
  return true;
}

const DEFAULT_HEADERS = {
  'User-Agent': 'AI-Status-Dashboard/1.0',
};

function computeProviderStatus(
  components: NormalizedComponent[],
  incidents: NormalizedIncident[],
  maintenances: NormalizedMaintenance[]
) {
  const activeIncidents = incidents.filter((incident) => {
    if (incident.resolvedAt) return false;
    return !['resolved', 'completed', 'cancelled'].includes(incident.status);
  });
  const activeMaintenances = maintenances.filter((maintenance) => {
    if (maintenance.completedAt) return false;
    return !['resolved', 'completed', 'cancelled'].includes(maintenance.status);
  });

  const severities = [
    ...components.map((c) => c.status),
    ...activeIncidents.map((i) => i.severity),
    ...activeMaintenances.map((m) => m.severity),
  ];

  if (severities.includes('major_outage')) return 'major_outage';
  if (severities.includes('partial_outage')) return 'partial_outage';
  if (severities.includes('degraded')) return 'degraded';
  if (severities.includes('maintenance')) return 'maintenance';
  if (severities.includes('operational')) return 'operational';
  if (
    activeIncidents.length === 0 &&
    activeMaintenances.length === 0 &&
    components.length === 0 &&
    (incidents.length > 0 || maintenances.length > 0)
  ) {
    return 'operational';
  }
  return 'unknown';
}

function summarizeEvidence(
  components: NormalizedComponent[],
  incidents: NormalizedIncident[],
  maintenances: NormalizedMaintenance[]
) {
  const activeIncidents = incidents.filter((incident) => {
    if (incident.resolvedAt) return false;
    return !['resolved', 'completed', 'cancelled'].includes(incident.status);
  });
  const activeMaintenances = maintenances.filter((maintenance) => {
    if (maintenance.completedAt) return false;
    return !['resolved', 'completed', 'cancelled'].includes(maintenance.status);
  });
  const degradedComponents = components.filter((component) =>
    ['degraded', 'partial_outage', 'major_outage', 'down', 'maintenance'].includes(component.status)
  );
  return {
    activeIncidentCount: activeIncidents.length,
    activeMaintenanceCount: activeMaintenances.length,
    degradedComponentCount: degradedComponents.length,
  };
}

async function fetchWithCache(
  sourceId: string,
  url: string,
  providerId?: string,
  platform?: PlatformType
): Promise<SourceFetchResult> {
  const meta = await sourceRegistryService.getEntry(sourceId);
  const headers: Record<string, string> = { ...DEFAULT_HEADERS };
  if (meta?.etag) headers['If-None-Match'] = meta.etag;
  if (meta?.lastModified) headers['If-Modified-Since'] = meta.lastModified;

  try {
    const response = await fetch(url, {
      headers,
      cache: 'no-store',
    });
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');

    if (response.status === 304) {
      const cachedPayload = await sourceRegistryService.getLatestPayload(sourceId);
      const body = cachedPayload?.body || undefined;
      const cachedContentType = cachedPayload?.headers?.['content-type'] || '';
      let json: any = null;
      if (body && (cachedContentType.includes('application/json') || body.trim().startsWith('{') || body.trim().startsWith('['))) {
        try {
          json = JSON.parse(body);
        } catch {
          json = null;
        }
      }

      if (!body) {
        try {
          const fallback = await fetch(url, { headers: DEFAULT_HEADERS, cache: 'no-store' });
          const fallbackBody = await fallback.text();
          let fallbackJson: any = null;
          if (
            fallbackBody.trim() &&
            (
              (fallback.headers.get('content-type') || '').includes('application/json') ||
              fallbackBody.trim().startsWith('{') ||
              fallbackBody.trim().startsWith('[')
            )
          ) {
            try {
              fallbackJson = JSON.parse(fallbackBody);
            } catch {
              fallbackJson = null;
            }
          }
          return {
            ok: fallback.ok,
            statusCode: fallback.status,
            body: fallbackBody,
            json: fallbackJson,
          };
        } catch {
          return { ok: true, statusCode: 304 };
        }
      }

      await sourceRegistryService.upsertEntry({
        sourceId,
        providerId: providerId || meta?.providerId || '',
        platform: platform || meta?.platform || 'unknown',
        etag: etag || meta?.etag || null,
        lastModified: lastModified || meta?.lastModified || null,
        lastStatusCode: response.status,
        lastFetchedAt: new Date().toISOString(),
      });
      return { ok: true, statusCode: 304, body, json };
    }

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    let json: any = null;
    if (body.trim()) {
      if (contentType.includes('application/json') || body.trim().startsWith('{') || body.trim().startsWith('[')) {
        try {
          json = JSON.parse(body);
        } catch {
          json = null;
        }
      }
    }

    await sourceRegistryService.recordPayload(sourceId, response.status, body, {
      'content-type': contentType,
    });

    await sourceRegistryService.upsertEntry({
      sourceId,
      providerId: providerId || meta?.providerId || '',
      platform: platform || meta?.platform || 'unknown',
      etag: etag || null,
      lastModified: lastModified || null,
      lastStatusCode: response.status,
      lastFetchedAt: new Date().toISOString(),
    });

    return {
      ok: response.ok,
      statusCode: response.status,
      etag,
      lastModified,
      body,
      json,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, statusCode: 0, error: message };
  }
}

async function storeNormalized(summary: NormalizedProviderSummary) {
  const db = getDb();
  const providerStatusRef = db.collection('provider_status').doc(summary.providerId);
  const batch = db.batch();
  const evidence = summarizeEvidence(summary.components, summary.incidents, summary.maintenances);

  batch.set(
    providerStatusRef,
    {
      providerId: summary.providerId,
      sourceId: summary.sourceId,
      status: summary.status,
      description: summary.description || null,
      lastUpdated: Timestamp.fromDate(new Date(summary.lastUpdated)),
      componentCount: summary.components.length,
      incidentCount: summary.incidents.length,
      maintenanceCount: summary.maintenances.length,
      activeIncidentCount: evidence.activeIncidentCount,
      activeMaintenanceCount: evidence.activeMaintenanceCount,
      degradedComponentCount: evidence.degradedComponentCount,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  summary.components.forEach((component) => {
    const docId = `${summary.providerId}:${component.id}`;
    if (!hasChangedSinceLastWrite(`components/${docId}`, component)) return;
    const ref = db.collection('components').doc(docId);
    batch.set(
      ref,
      {
        ...component,
        updatedAt: component.updatedAt ? Timestamp.fromDate(new Date(component.updatedAt)) : FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  if (summary.providerId === 'google-ai') {
    const componentMap = new Map<string, string>();
    summary.incidents.forEach((incident) => {
      if (!incident.impactedComponents) return;
      incident.impactedComponents.forEach((id, index) => {
        if (!id) return;
        const name = incident.impactedComponentNames?.[index] || id;
        if (!componentMap.has(id)) {
          componentMap.set(id, name);
        }
      });
    });

    componentMap.forEach((name, id) => {
      const docId = `${summary.providerId}:${id}`;
      const ref = db.collection('components').doc(docId);
      batch.set(
        ref,
        {
          id,
          providerId: summary.providerId,
          name,
          status: 'unknown',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  summary.incidents.forEach((incident) => {
    const docId = `${summary.providerId}:${incident.id}`;
    if (!hasChangedSinceLastWrite(`incidents/${docId}`, incident)) return;
    const ref = db.collection('incidents').doc(docId);
    batch.set(
      ref,
      {
        ...incident,
        startedAt: Timestamp.fromDate(new Date(incident.startedAt)),
        updatedAt: Timestamp.fromDate(new Date(incident.updatedAt)),
        resolvedAt: incident.resolvedAt ? Timestamp.fromDate(new Date(incident.resolvedAt)) : null,
        ingestedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  summary.maintenances.forEach((maintenance) => {
    const docId = `${summary.providerId}:${maintenance.id}`;
    if (!hasChangedSinceLastWrite(`maintenances/${docId}`, maintenance)) return;
    const ref = db.collection('maintenances').doc(docId);
    batch.set(
      ref,
      {
        ...maintenance,
        scheduledFor: Timestamp.fromDate(new Date(maintenance.scheduledFor)),
        updatedAt: Timestamp.fromDate(new Date(maintenance.updatedAt)),
        completedAt: maintenance.completedAt ? Timestamp.fromDate(new Date(maintenance.completedAt)) : null,
        ingestedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  // Detect incidents we have not stored before (only recent ones, to keep the
  // existence check to at most a couple of reads per ingest) so fresh outage
  // pages can be pushed to search engines the moment they exist.
  const freshCutoff = Date.now() - 48 * 60 * 60 * 1000;
  const candidates = summary.incidents.filter((incident) => {
    const started = Date.parse(incident.startedAt);
    return Number.isFinite(started) && started >= freshCutoff;
  });
  let newIncidentIds: string[] = [];
  if (candidates.length) {
    try {
      const refs = candidates.map((incident) =>
        db.collection('incidents').doc(`${summary.providerId}:${incident.id}`)
      );
      const existing = await db.getAll(...refs);
      newIncidentIds = candidates
        .filter((_, index) => !existing[index]?.exists)
        .map((incident) => `${summary.providerId}:${incident.id}`);
    } catch {
      newIncidentIds = [];
    }
  }

  await batch.commit();

  if (newIncidentIds.length) {
    const appId = APP_ID_BY_PROVIDER.get(summary.providerId);
    const paths = newIncidentIds.map((id) => `/incidents/${id}`);
    paths.push('/incidents');
    if (appId) paths.push(`/${appId}`);
    // Fire-and-forget: indexing pings must never slow ingestion down.
    void pingIndexNow(paths);
  }
}

export class SourceIngestionService {
  private sources: SourceDefinition[];

  constructor() {
    this.sources = (sourcesConfig as { sources: SourceDefinition[] }).sources || [];
  }

  async ingestAll(options: { force?: boolean } = {}): Promise<{ processed: number; skipped: number }> {
    let processed = 0;
    let skipped = 0;
    const force = options.force === true;

    for (const source of this.sources) {
      const didRun = await this.ingestSource(source, force);
      if (didRun) {
        processed += 1;
      } else {
        skipped += 1;
      }
    }

    return { processed, skipped };
  }

  async ingestSource(source: SourceDefinition, force = false): Promise<boolean> {
    const now = new Date();
    const meta = await sourceRegistryService.getEntry(source.id);
    if (!force && meta?.nextFetchAt) {
      const next = new Date(meta.nextFetchAt);
      if (next > now) return false;
    }

    let platformInfo =
      source.platform && source.platform !== 'auto'
        ? { platform: source.platform as PlatformType }
        : await detectPlatform(source.baseUrl);

    if (platformInfo.platform === 'statusio' && !platformInfo.statusIoPageId) {
      const detected = await detectPlatform(source.baseUrl);
      if (detected.statusIoPageId) {
        platformInfo = { ...platformInfo, statusIoPageId: detected.statusIoPageId };
      }
    }

    const platform = platformInfo.platform;
    const base = source.baseUrl.replace(/\/$/, '');

    await sourceRegistryService.upsertEntry({
      sourceId: source.id,
      providerId: source.providerId,
      platform,
      lastFetchedAt: now.toISOString(),
      nextFetchAt: new Date(now.getTime() + source.pollIntervalSeconds * 1000).toISOString(),
    });

    const summary = await this.fetchPlatform(source, platform, base, platformInfo.statusIoPageId || source.metadata?.statusIoPageId);
    if (!summary) return true;

    await storeNormalized(summary);
    return true;
  }

  private async fetchPlatform(
    source: SourceDefinition,
    platform: PlatformType,
    base: string,
    statusIoPageId?: string
  ): Promise<NormalizedProviderSummary | null> {
    switch (platform) {
      case 'statuspage':
        return this.fetchStatuspage(source, base);
      case 'instatus':
        return this.fetchInstatus(source, base);
      case 'meta':
        return this.fetchMeta(source, base);
      case 'google-cloud':
        return this.fetchGoogleCloud(source);
      case 'rss':
        return this.fetchRss(source);
      case 'cachet':
        return this.fetchCachet(source, base);
      case 'statusio':
        return this.fetchStatusIo(source, base, statusIoPageId);
      case 'betterstack':
        return this.fetchBetterstack(source, base);
      default:
        return this.fetchHtmlStatus(source, base);
    }
  }

  private async fetchStatuspage(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const summaryUrl = `${base}/api/v2/summary.json`;
    const incidentsUrl = `${base}/api/v2/incidents.json`;
    const maintUpcomingUrl = `${base}/api/v2/scheduled-maintenances/upcoming.json`;
    const maintActiveUrl = `${base}/api/v2/scheduled-maintenances/active.json`;

    const summaryResponse = await fetchWithCache(`${source.id}:summary`, summaryUrl, source.providerId, 'statuspage');
    if (!summaryResponse.ok) return null;

    if (!summaryResponse.json) {
      let htmlStatus = parseHtmlResponse(summaryResponse.body || '');
      const bodyText = summaryResponse.body || '';
      const lowerBody = bodyText.toLowerCase();
      if (
        htmlStatus === 'unknown' &&
        (lowerBody.includes('page not found') || lowerBody.includes('not found'))
      ) {
        const fallbackHtml = await fetchWithCache(`${source.id}:html-fallback`, base, source.providerId, 'html');
        if (fallbackHtml.ok && fallbackHtml.body) {
          htmlStatus = parseHtmlResponse(fallbackHtml.body);
        }
      }
      const status =
        htmlStatus === 'down'
          ? 'major_outage'
          : htmlStatus === 'degraded'
            ? 'degraded'
            : htmlStatus === 'operational'
              ? 'operational'
              : 'unknown';
      return {
        providerId: source.providerId,
        sourceId: source.id,
        status,
        description: 'HTML status page',
        lastUpdated: new Date().toISOString(),
        components: [],
        incidents: [],
        maintenances: [],
      };
    }

    const components = parseStatuspageComponents(source.providerId, summaryResponse.json);
    const incidents = parseStatuspageIncidents(source.providerId, source.id, summaryResponse.json);
    let fullIncidents = incidents;

    const incidentsResponse = await fetchWithCache(`${source.id}:incidents`, incidentsUrl, source.providerId, 'statuspage');
    if (incidentsResponse.ok && incidentsResponse.json) {
      fullIncidents = parseStatuspageIncidents(source.providerId, source.id, incidentsResponse.json);
    }

    const maintenances: NormalizedMaintenance[] = [];
    const upcomingResponse = await fetchWithCache(`${source.id}:maint-upcoming`, maintUpcomingUrl, source.providerId, 'statuspage');
    if (upcomingResponse.ok && upcomingResponse.json) {
      maintenances.push(...parseStatuspageMaintenances(source.providerId, source.id, upcomingResponse.json));
    }
    const activeResponse = await fetchWithCache(`${source.id}:maint-active`, maintActiveUrl, source.providerId, 'statuspage');
    if (activeResponse.ok && activeResponse.json) {
      maintenances.push(...parseStatuspageMaintenances(source.providerId, source.id, activeResponse.json));
    }

    const status = normalizeSeverity(summaryResponse.json?.status?.indicator || summaryResponse.json?.status?.description);

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status: status === 'unknown' ? computeProviderStatus(components, fullIncidents, maintenances) : status,
      description: summaryResponse.json?.status?.description || undefined,
      lastUpdated: new Date().toISOString(),
      components,
      incidents: fullIncidents,
      maintenances,
    };
  }

  private async fetchInstatus(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const summaryUrl = `${base}/summary.json`;
    const summaryResponse = await fetchWithCache(`${source.id}:summary`, summaryUrl, source.providerId, 'instatus');
    if (!summaryResponse.ok || !summaryResponse.json) return null;

    const parsed = parseInstatusSummary(source.providerId, source.id, summaryResponse.json);
    const status = parsed.status === 'unknown'
      ? computeProviderStatus(parsed.components, parsed.incidents, parsed.maintenances)
      : parsed.status;

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: parsed.statusDescription,
      lastUpdated: new Date().toISOString(),
      components: parsed.components,
      incidents: parsed.incidents,
      maintenances: parsed.maintenances,
    };
  }

  private async fetchGoogleCloud(source: SourceDefinition): Promise<NormalizedProviderSummary | null> {
    const url = source.statusUrl || `${source.baseUrl.replace(/\/$/, '')}/incidents.json`;
    const response = await fetchWithCache(`${source.id}:incidents`, url, source.providerId, 'google-cloud');
    if (!response.ok || !response.json) return null;

    const catalog = await getGcpProductCatalog();
    let incidents = parseGoogleCloudIncidents(source.providerId, source.id, response.json, catalog);
    if (source.providerId === 'google-ai') {
      incidents = filterGoogleCloudIncidentsForAi(incidents, GOOGLE_AI_KEYWORDS);
    }
    const status = computeProviderStatus([], incidents, []);

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description:
        source.providerId === 'google-ai'
          ? 'Google Cloud Service Health (Vertex AI / Gemini only)'
          : 'Google Cloud Service Health',
      lastUpdated: new Date().toISOString(),
      components: [],
      incidents,
      maintenances: [],
    };
  }

  private async fetchRss(source: SourceDefinition): Promise<NormalizedProviderSummary | null> {
    const url = source.statusUrl || source.baseUrl;
    const response = await fetchWithCache(`${source.id}:rss`, url, source.providerId, 'rss');
    if (!response.ok || !response.body) return null;

    const filter = source.metadata?.filter;
    const incidents = parseRssIncidents(source.providerId, source.id, response.body, filter);
    const status = incidents.length === 0 && filter
      ? 'operational'
      : computeProviderStatus([], incidents, []);

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'RSS feed',
      lastUpdated: new Date().toISOString(),
      components: [],
      incidents,
      maintenances: [],
    };
  }

  private async fetchMeta(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const url = source.statusUrl || `${base.replace(/\/$/, '')}/data/orgs.json`;
    const response = await fetchWithCache(`${source.id}:meta`, url, source.providerId, 'meta');
    if (!response.ok || !response.json) return null;

    const orgs = Array.isArray(response.json) ? response.json : [];
    const metaOrg = orgs.find((org) =>
      String(org?.name || '')
        .toLowerCase()
        .includes('meta')
    );
    const metaStatus = parseMetaStatusResponse(metaOrg ? [metaOrg] : orgs);
    const status =
      metaStatus === 'down'
        ? 'major_outage'
        : metaStatus === 'degraded'
          ? 'degraded'
          : metaStatus === 'operational'
            ? 'operational'
            : 'unknown';

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'Meta status',
      lastUpdated: new Date().toISOString(),
      components: [],
      incidents: [],
      maintenances: [],
    };
  }

  private async fetchCachet(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const componentsUrl = `${base}/api/v1/components`;
    const incidentsUrl = `${base}/api/v1/incidents`;

    const componentsResponse = await fetchWithCache(`${source.id}:components`, componentsUrl, source.providerId, 'cachet');
    if (!componentsResponse.ok || !componentsResponse.json) return null;

    const incidentsResponse = await fetchWithCache(`${source.id}:incidents`, incidentsUrl, source.providerId, 'cachet');
    const components = parseCachetComponents(source.providerId, componentsResponse.json);
    const incidents = incidentsResponse.ok && incidentsResponse.json
      ? parseCachetIncidents(source.providerId, source.id, incidentsResponse.json)
      : [];

    const status = computeProviderStatus(components, incidents, []);

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'Cachet status',
      lastUpdated: new Date().toISOString(),
      components,
      incidents,
      maintenances: [],
    };
  }

  private async fetchStatusIo(
    source: SourceDefinition,
    base: string,
    statusIoPageId?: string
  ): Promise<NormalizedProviderSummary | null> {
    const pageId = statusIoPageId || source.metadata?.statusIoPageId;
    if (!pageId) {
      return null;
    }
    const apiUrl = `https://api.status.io/1.0/status/${pageId}`;
    const response = await fetchWithCache(`${source.id}:statusio`, apiUrl, source.providerId, 'statusio');
    if (!response.ok || !response.json) return null;

    const parsed = parseStatusIo(source.providerId, source.id, response.json);
    const status = parsed.status === 'unknown'
      ? computeProviderStatus(parsed.components, parsed.incidents, parsed.maintenances)
      : parsed.status;

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'Status.io',
      lastUpdated: new Date().toISOString(),
      components: parsed.components,
      incidents: parsed.incidents,
      maintenances: parsed.maintenances,
    };
  }

  private async fetchBetterstack(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const indexUrl = source.statusUrl || `${base}/index.json`;
    const indexResponse = await fetchWithCache(`${source.id}:index`, indexUrl, source.providerId, 'betterstack');
    if (!indexResponse.ok || !indexResponse.json) return null;

    const parsed = parseBetterstackIndex(source.providerId, source.id, indexResponse.json);
    const status = parsed.status === 'unknown'
      ? computeProviderStatus(parsed.components, parsed.incidents, parsed.maintenances)
      : parsed.status;

    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: parsed.statusDescription || 'Better Stack status',
      lastUpdated: new Date().toISOString(),
      components: parsed.components,
      incidents: parsed.incidents,
      maintenances: parsed.maintenances,
    };
  }

  private async fetchHtmlStatus(source: SourceDefinition, base: string): Promise<NormalizedProviderSummary | null> {
    const response = await fetchWithCache(`${source.id}:html`, base, source.providerId, 'html');
    if (!response.ok || !response.body) return null;
    const status = normalizeSeverity(response.body);
    return {
      providerId: source.providerId,
      sourceId: source.id,
      status,
      description: 'HTML status page',
      lastUpdated: new Date().toISOString(),
      components: [],
      incidents: [],
      maintenances: [],
    };
  }
}

export const sourceIngestionService = new SourceIngestionService();
