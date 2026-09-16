import { ImageResponse } from 'next/og';
import { getCasualApp, getCasualStatus } from '@/lib/services/casual';
import { shortName } from '@/lib/ui/verdict';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function GET(
  _request: Request,
  { params }: { params: { appId: string } | Promise<{ appId: string }> }
) {
  const resolved = await Promise.resolve(params as { appId: string });
  const appId = resolved.appId.replace(/\.svg$/i, '');
  const app = getCasualApp(appId);
  if (!app) return new Response('Not found', { status: 404 });
  const status = await getCasualStatus({ appId: app.id }).catch(() => null);
  const name = shortName(app.id, app.label);
  const s = status?.overall_status;
  const statusText = !status ? 'status check in progress' : s === 'down' ? 'looks down right now' : s === 'degraded' ? 'is having issues' : s === 'unknown' ? "status can't be read" : 'is up';
  const accent = s === 'down' ? '#fb7185' : s === 'degraded' ? '#fbbf24' : s === 'unknown' ? '#94a3b8' : '#34d399';
  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: '#0f172a' }}>
        <div style={{ color: '#94a3b8', fontSize: 40 }}>Is {name} down right now?</div>
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: accent }} />
          <div style={{ fontSize: 84, fontWeight: 700, color: accent }}>{name} {statusText}</div>
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: '#64748b' }}>{app.providerDisplay}&apos;s official status, read every 5 minutes · aistatusdashboard.com/{app.id}</div>
      </div>
    ),
    size
  );
}
