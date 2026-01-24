import { NextResponse } from 'next/server';
import { upsertIncident } from '@/lib/services/incident-store';
import { normalizeSeverity, normalizeIncidentStatus } from '@/lib/utils/platform-parsers';

function requireIngestSecret(request: Request): NextResponse | null {
  const secret = process.env.AWS_INGEST_SECRET || process.env.APP_AWS_INGEST_SECRET;
  const allowOpen = process.env.APP_ALLOW_AWS_INGEST === 'true';
  if (allowOpen) return null;
  if (!secret) {
    return NextResponse.json({ error: 'AWS_INGEST_SECRET is required.' }, { status: 503 });
  }
  const headerSecret = request.headers.get('x-ingest-secret');
  if (headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const auth = requireIngestSecret(request);
  if (auth) return auth;

  try {
    const payload = await request.json();
    const detail = payload.detail || {};
    const eventArn = detail.eventArn || payload.id || 'aws-event';
    const service = detail.service || detail.serviceName || 'AWS';
    const region = detail.affectedRegion || detail.region || 'global';
    const statusRaw = detail.statusCode || detail.eventStatusCode || detail.status || 'unknown';
    const severityRaw = detail.eventTypeCategory || detail.severity || statusRaw;
    const description = Array.isArray(detail.eventDescription)
      ? detail.eventDescription[0]?.latestDescription
      : detail.description;

    await upsertIncident({
      id: eventArn,
      providerId: 'aws',
      sourceId: 'aws-eventbridge',
      title: detail.eventTypeCode || `${service} incident`,
      status: normalizeIncidentStatus(statusRaw),
      severity: normalizeSeverity(severityRaw),
      startedAt: detail.startTime || payload.time || new Date().toISOString(),
      updatedAt: detail.lastUpdatedTime || payload.time || new Date().toISOString(),
      resolvedAt: detail.endTime || undefined,
      impactedRegions: [region].filter(Boolean),
      impactedComponents: [service].filter(Boolean),
      updates: description
        ? [
            {
              id: `${eventArn}-update`,
              status: normalizeIncidentStatus(statusRaw),
              body: description,
              createdAt: detail.lastUpdatedTime || payload.time || new Date().toISOString(),
            },
          ]
        : [],
      sourceSeverity: severityRaw,
      sourceStatus: statusRaw,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to ingest AWS event' }, { status: 500 });
  }
}
