import { NextResponse } from 'next/server';
import { upsertIncident } from '@/lib/services/incident-store';
import { normalizeSeverity, normalizeIncidentStatus } from '@/lib/utils/platform-parsers';

function requireIngestSecret(request: Request): NextResponse | null {
  const secret = process.env.GCP_INGEST_SECRET || process.env.APP_GCP_INGEST_SECRET;
  const allowOpen = process.env.APP_ALLOW_GCP_INGEST === 'true';
  if (allowOpen) return null;
  if (!secret) {
    return NextResponse.json({ error: 'GCP_INGEST_SECRET is required.' }, { status: 503 });
  }
  const headerSecret = request.headers.get('x-ingest-secret');
  const urlSecret = new URL(request.url).searchParams.get('secret');
  if (headerSecret !== secret && urlSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const auth = requireIngestSecret(request);
  if (auth) return auth;

  try {
    const payload = await request.json();
    let decodedPayload: any = payload;
    if (payload?.message?.data) {
      try {
        const raw = Buffer.from(payload.message.data, 'base64').toString('utf8');
        decodedPayload = JSON.parse(raw);
      } catch {
        decodedPayload = payload;
      }
    }

    const event =
      decodedPayload.incident ||
      decodedPayload.event ||
      decodedPayload.jsonPayload ||
      decodedPayload.protoPayload ||
      decodedPayload;

    const incidentId =
      event.id ||
      event.incident_id ||
      decodedPayload.insertId ||
      payload.insertId ||
      'gcp-event';
    const title = event.title || event.summary || event.service_name || event.message || 'GCP incident';
    const statusRaw = event.status || event.state || 'unknown';
    const severityRaw = event.severity || event.status_impact || statusRaw;
    const startedAt = event.started_at || event.begin || event.startTime || new Date().toISOString();
    const updatedAt = event.updated_at || event.modified || new Date().toISOString();

    await upsertIncident({
      id: incidentId,
      providerId: 'google-ai',
      sourceId: 'gcp-health',
      title,
      status: normalizeIncidentStatus(statusRaw),
      severity: normalizeSeverity(severityRaw),
      startedAt,
      updatedAt,
      resolvedAt: event.resolved_at || event.end || undefined,
      impactedRegions: event.affected_regions || event.affected_locations || [],
      impactedComponents: event.affected_products || [],
      updates: event.updates || [],
      sourceSeverity: severityRaw,
      sourceStatus: statusRaw,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to ingest GCP event' }, { status: 500 });
  }
}
