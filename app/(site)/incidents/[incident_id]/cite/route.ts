import { NextRequest, NextResponse } from 'next/server';
import { getIncidentById } from '@/lib/services/public-data';

export const runtime = 'nodejs';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function GET(request: NextRequest, { params }: { params: { incident_id?: string } }) {
  const paramId = params?.incident_id || '';
  const pathId = request.nextUrl.pathname.split('/').slice(-2, -1)[0] || '';
  const id = decodeURIComponent(paramId || pathId).trim();
  if (!id) {
    return NextResponse.json({ error: 'Missing incident id' }, { status: 400 });
  }
  const incident = await getIncidentById(id);
  if (!incident) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const now = new Date().toISOString();
  const evidenceUrls = [`https://aistatusdashboard.com/incidents/${id}`];
  if (incident.rawUrl) evidenceUrls.push(incident.rawUrl);
  const content_hash = await sha256Hex(JSON.stringify(incident));
  const payload = {
    title: incident.title,
    incident_id: id,
    providers: [incident.providerId],
    impacted: {
      models: incident.impactedModels || [],
      regions: incident.impactedRegions || [],
      endpoints: incident.impactedComponents || [],
    },
    time_window: { started_at: incident.startedAt, observed_at: incident.updatedAt },
    evidence_urls: evidenceUrls,
    source_urls: incident.rawUrl ? [incident.rawUrl] : [],
    generated_at: now,
    content_hash,
  };
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
