import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db/firestore';
import { upsertIncident } from '@/lib/services/incident-store';
import { normalizeSeverity, normalizeIncidentStatus } from '@/lib/utils/platform-parsers';

function requireIngestSecret(request: Request): NextResponse | null {
  const secret = process.env.BETTERSTACK_INGEST_SECRET || process.env.APP_BETTERSTACK_INGEST_SECRET;
  const allowOpen = process.env.APP_ALLOW_BETTERSTACK_INGEST === 'true';
  if (allowOpen) return null;
  if (!secret) {
    return NextResponse.json({ error: 'BETTERSTACK_INGEST_SECRET is required.' }, { status: 503 });
  }
  const headerSecret = request.headers.get('x-ingest-secret');
  if (headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

function hashPayload(payload: any) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function POST(request: Request) {
  const auth = requireIngestSecret(request);
  if (auth) return auth;

  try {
    const payload = await request.json();
    const eventId = payload.id || payload.event?.id || payload.data?.id || hashPayload(payload);
    const eventType = payload.type || payload.event?.type || payload.event_name || 'incident';

    const db = getDb();
    const dedupeRef = db.collection('ingest_events').doc(String(eventId));
    const existing = await dedupeRef.get();
    if (existing.exists) {
      return NextResponse.json({ ok: true, deduped: true });
    }

    await dedupeRef.set({
      eventType,
      provider: payload.provider || payload.service || 'unknown',
      receivedAt: new Date().toISOString(),
    });

    const incidentPayload = payload.incident || payload.data || payload;
    const providerId = incidentPayload.provider_id || incidentPayload.provider || payload.provider_id || 'unknown';
    const title = incidentPayload.title || incidentPayload.name || 'Incident';
    const statusRaw = incidentPayload.status || incidentPayload.state || eventType;
    const severityRaw = incidentPayload.severity || incidentPayload.impact || statusRaw;

    await upsertIncident({
      id: String(eventId),
      providerId,
      sourceId: 'betterstack-webhook',
      title,
      status: normalizeIncidentStatus(statusRaw),
      severity: normalizeSeverity(severityRaw),
      startedAt: incidentPayload.started_at || incidentPayload.created_at || new Date().toISOString(),
      updatedAt: incidentPayload.updated_at || new Date().toISOString(),
      resolvedAt: incidentPayload.resolved_at || undefined,
      impactedComponents: incidentPayload.components || incidentPayload.affected_components || undefined,
      updates: Array.isArray(incidentPayload.updates)
        ? incidentPayload.updates.map((update: any) => ({
            id: update.id || update.created_at || hashPayload(update),
            status: normalizeIncidentStatus(update.status || update.state || statusRaw),
            body: update.body || update.message || '',
            createdAt: update.created_at || new Date().toISOString(),
          }))
        : [],
      sourceSeverity: severityRaw,
      sourceStatus: statusRaw,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to ingest Better Stack event' }, { status: 500 });
  }
}
