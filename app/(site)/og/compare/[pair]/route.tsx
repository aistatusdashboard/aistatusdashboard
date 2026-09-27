import { ImageResponse } from 'next/og';
import { getCasualApp, getCasualStatus } from '@/lib/services/casual';
import { getAppReliability } from '@/lib/services/reliability';
import { shortName } from '@/lib/ui/verdict';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export async function GET(_req: Request, { params }: { params: { pair: string } | Promise<{ pair: string }> }) {
  const resolved = await Promise.resolve(params as { pair: string });
  const m = /^(.+?)-vs-(.+)$/.exec(resolved.pair.toLowerCase());
  if (!m) return new Response('Not found', { status: 404 });
  const a = getCasualApp(m[1]);
  const b = getCasualApp(m[2]);
  if (!a || !b) return new Response('Not found', { status: 404 });
  const [ra, rb] = await Promise.all([getAppReliability(a.providerId).catch(() => null), getAppReliability(b.providerId).catch(() => null)]);
  await Promise.all([getCasualStatus({ appId: a.id }).catch(() => null)]);
  const na = shortName(a.id, a.label);
  const nb = shortName(b.id, b.label);
  const cell = (name: string, r: { uptimePct: number; incidentCount: number } | null) => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 40px' }}>
      <div style={{ fontSize: 54, fontWeight: 700, color: '#f8fafc' }}>{name}</div>
      <div style={{ fontSize: 40, color: '#34d399', marginTop: 12 }}>{r ? `${r.uptimePct.toFixed(2)}% uptime` : '—'}</div>
      <div style={{ fontSize: 30, color: '#94a3b8', marginTop: 6 }}>{r ? `${r.incidentCount} incidents / 30d` : ''}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '70px', background: '#0f172a' }}>
        <div style={{ fontSize: 34, color: '#94a3b8' }}>{`${na} vs ${nb} — reliability`}</div>
        <div style={{ display: 'flex', marginTop: 30, alignItems: 'center' }}>
          {cell(na, ra)}
          <div style={{ fontSize: 44, color: '#475569' }}>vs</div>
          {cell(nb, rb)}
        </div>
        <div style={{ fontSize: 28, color: '#64748b', marginTop: 36 }}>aistatusdashboard.com</div>
      </div>
    ),
    size
  );
}
