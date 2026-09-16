import { ImageResponse } from 'next/og';
import { getIncidentById } from '@/lib/services/public-data';
import { appNameForProvider } from '@/lib/casual/app-lookup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function decode(v: string) {
  try { return decodeURIComponent(v); } catch { return v; }
}

export async function GET(
  _request: Request,
  { params }: { params: { incident_id: string } | Promise<{ incident_id: string }> }
) {
  const resolved = await Promise.resolve(params as { incident_id: string });
  const incident = await getIncidentById(decode(resolved.incident_id)).catch(() => null);
  if (!incident) return new Response('Not found', { status: 404 });
  const name = appNameForProvider(incident.providerId);
  const done = Boolean(incident.resolvedAt) || ['resolved', 'completed', 'cancelled'].includes(String(incident.status).toLowerCase());
  const accent = done ? '#34d399' : '#fb7185';
  const when = incident.startedAt
    ? new Date(incident.startedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : '';
  const title = incident.title.length > 90 ? `${incident.title.slice(0, 87)}…` : incident.title;
  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: accent }} />
          <div style={{ color: accent, fontSize: 32, letterSpacing: 3, textTransform: 'uppercase' }}>{name} incident · {done ? 'Resolved' : 'Ongoing'}</div>
        </div>
        <div style={{ marginTop: 28, fontSize: 60, fontWeight: 700, color: '#f8fafc', lineHeight: 1.15 }}>{title}</div>
        <div style={{ marginTop: 28, fontSize: 30, color: '#94a3b8' }}>{when ? `${when} · ` : ''}{name}&apos;s official report, in plain English · aistatusdashboard.com</div>
      </div>
    ),
    size
  );
}
