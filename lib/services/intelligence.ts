import { getDb } from '@/lib/db/firestore';
import { TtlCache } from '@/lib/utils/ttl-cache';
import { Timestamp } from 'firebase-admin/firestore';
import type {
  NormalizedIncident,
  NormalizedMaintenance,
  NormalizedComponent,
} from '@/lib/types/ingestion';
import { ProviderStatus } from '@/lib/types';
import { log } from '@/lib/utils/logger';
import { filterGoogleCloudIncidentsForAi, GOOGLE_AI_KEYWORDS } from '@/lib/utils/google-cloud';
import { normalizeIncidentDates, normalizeMaintenanceDates } from '@/lib/utils/normalize-dates';

// Short-lived read cache for the incidents collection. Automated clients poll
// the public routes continuously; without this, each poll was a fresh Firestore
// query (20.8M reads in two days, ~95% of the project's bill).
const incidentsCache = new TtlCache<NormalizedIncident[]>(60_000, 100);

function rememberIncidents(key: string, data: NormalizedIncident[]): void {
  incidentsCache.set(key, [...data]);
}

export type ProviderStatusSummary = {
  providerId: string;
  status: ProviderStatus | string;
  description?: string | null;
  lastUpdated?: string;
  componentCount?: number;
  incidentCount?: number;
  maintenanceCount?: number;
  activeIncidentCount?: number;
  activeMaintenanceCount?: number;
  degradedComponentCount?: number;
};

class IntelligenceService {
  async getProviderSummaries(): Promise<ProviderStatusSummary[]> {
    const db = getDb();
    try {
      const snapshot = await db.collection('provider_status').get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        const lastUpdated = data.lastUpdated?.toDate?.()?.toISOString?.() || null;
        return {
          providerId: doc.id,
          status: data.status,
          description: data.description || null,
          lastUpdated,
          componentCount: data.componentCount || null,
          incidentCount: data.incidentCount || null,
          maintenanceCount: data.maintenanceCount || null,
          activeIncidentCount: data.activeIncidentCount || 0,
          activeMaintenanceCount: data.activeMaintenanceCount || 0,
          degradedComponentCount: data.degradedComponentCount || 0,
        } as ProviderStatusSummary;
      });
    } catch (error) {
      log('error', 'Failed to load provider summaries', { error });
      return [];
    }
  }

  async getProviderDetail(providerId: string): Promise<{
    components: NormalizedComponent[];
    incidents: NormalizedIncident[];
    maintenances: NormalizedMaintenance[];
  }> {
    if (!providerId) {
      return { components: [], incidents: [], maintenances: [] };
    }
    const db = getDb();
    let componentsSnap: FirebaseFirestore.QuerySnapshot | null = null;
    try {
      componentsSnap = await db.collection('components').where('providerId', '==', providerId).get();
    } catch (error) {
      log('warn', 'Components query failed, returning empty set', { error, providerId });
      componentsSnap = null;
    }

    let incidentsSnap;
    try {
      incidentsSnap = await db
        .collection('incidents')
        .where('providerId', '==', providerId)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();
    } catch (error) {
      log('warn', 'Incidents query failed, falling back to unordered query', { error, providerId });
      incidentsSnap = await db
        .collection('incidents')
        .where('providerId', '==', providerId)
        .limit(50)
        .get();
    }

    let maintSnap;
    try {
      maintSnap = await db
        .collection('maintenances')
        .where('providerId', '==', providerId)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();
    } catch (error) {
      log('warn', 'Maintenances query failed, falling back to unordered query', { error, providerId });
      maintSnap = await db
        .collection('maintenances')
        .where('providerId', '==', providerId)
        .limit(50)
        .get();
    }

    const components = componentsSnap ? componentsSnap.docs.map((doc) => doc.data() as NormalizedComponent) : [];
    let incidents = incidentsSnap.docs.map((doc) => normalizeIncidentDates(doc.data() as NormalizedIncident));
    const maintenances = maintSnap.docs.map((doc) =>
      normalizeMaintenanceDates(doc.data() as NormalizedMaintenance)
    );

    if (providerId === 'google-ai') {
      incidents = filterGoogleCloudIncidentsForAi(incidents, GOOGLE_AI_KEYWORDS);
    }

    return { components, incidents, maintenances };
  }

  async getIncidents(options: { providerId?: string; startDate?: string; limit?: number } = {}) {
    // Incidents change at most once per ingest cycle (5 min), but this read is
    // reachable from public routes that automated clients poll continuously.
    // A short in-process cache keeps that traffic off Firestore entirely.
    const cacheKey = JSON.stringify([options.providerId || '', options.startDate || '', options.limit || 0]);
    const cached = incidentsCache.get(cacheKey);
    if (cached) return [...cached];

    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection('incidents').orderBy('updatedAt', 'desc');
    if (options.providerId) {
      query = query.where('providerId', '==', options.providerId);
    }
    if (options.startDate) {
      const start = new Date(options.startDate);
      if (!Number.isNaN(start.getTime())) {
        query = query.where('updatedAt', '>=', Timestamp.fromDate(start));
      }
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    try {
      const snapshot = await query.get();
      let incidents = snapshot.docs.map((doc) => normalizeIncidentDates(doc.data() as NormalizedIncident));
      if (options.providerId === 'google-ai') {
        incidents = filterGoogleCloudIncidentsForAi(incidents, GOOGLE_AI_KEYWORDS);
      }
      rememberIncidents(cacheKey, incidents);
      return incidents;
    } catch (error) {
      log('warn', 'Incidents query failed, falling back to basic query', { error, options });
      let fallback: FirebaseFirestore.Query = db.collection('incidents');
      if (options.providerId) {
        fallback = fallback.where('providerId', '==', options.providerId);
      }
      if (options.limit) {
        fallback = fallback.limit(options.limit);
      } else {
        fallback = fallback.limit(50);
      }
      const snapshot = await fallback.get();
      let incidents = snapshot.docs.map((doc) => normalizeIncidentDates(doc.data() as NormalizedIncident));
      if (options.providerId === 'google-ai') {
        incidents = filterGoogleCloudIncidentsForAi(incidents, GOOGLE_AI_KEYWORDS);
      }
      return incidents;
    }
  }

  async getMaintenances(options: { providerId?: string; limit?: number } = {}) {
    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection('maintenances').orderBy('updatedAt', 'desc');
    if (options.providerId) {
      query = query.where('providerId', '==', options.providerId);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    try {
      const snapshot = await query.get();
      return snapshot.docs.map((doc) =>
        normalizeMaintenanceDates(doc.data() as NormalizedMaintenance)
      );
    } catch (error) {
      log('warn', 'Maintenances query failed, falling back to basic query', { error, options });
      let fallback: FirebaseFirestore.Query = db.collection('maintenances');
      if (options.providerId) {
        fallback = fallback.where('providerId', '==', options.providerId);
      }
      if (options.limit) {
        fallback = fallback.limit(options.limit);
      } else {
        fallback = fallback.limit(50);
      }
      const snapshot = await fallback.get();
      return snapshot.docs.map((doc) =>
        normalizeMaintenanceDates(doc.data() as NormalizedMaintenance)
      );
    }
  }
}

export const intelligenceService = new IntelligenceService();
