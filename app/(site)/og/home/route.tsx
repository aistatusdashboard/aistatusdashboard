import { ImageResponse } from 'next/og';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';
import { listCasualApps } from '@/lib/services/casual';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Social crawlers (X, LinkedIn, iMessage, Slack) fetch this with a short timeout
// and cache the result. Serve it as a public, CDN-cacheable image so the crawler
// gets it instantly from the edge instead of risking a cold-start origin fetch
// that times out into a blank card. The live status may lag the cache window,
// which is fine for a share card.
const OG_CACHE = 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800';

// PNG, because every social platform (X, LinkedIn, iMessage, Slack, WhatsApp)
// ignores an SVG og:image and shows a blank card — and shares during an
// outage are how this site spreads.
export async function GET() {
  const pulse = await getLivePulseSnapshot().catch(() => ({ status: 'operational' as const }));
  const down = pulse.status === 'down';
  const degraded = pulse.status === 'degraded';
  const accent = down ? '#fb7185' : degraded ? '#fbbf24' : '#34d399';
  const line = down
    ? 'Some AI apps are down right now.'
    : degraded
      ? 'Some AI apps are having issues.'
      : 'Every AI app we watch is up.';
  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#94a3b8', fontSize: 30, letterSpacing: 4, textTransform: 'uppercase' }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: accent }} />
          Live · aistatusdashboard.com
        </div>
        <div style={{ marginTop: 28, fontSize: 76, fontWeight: 700, color: '#f8fafc' }}>Is your AI down right now?</div>
        <div style={{ marginTop: 24, fontSize: 44, color: accent }}>{line}</div>
        <div style={{ marginTop: 20, fontSize: 30, color: '#cbd5e1' }}>{`ChatGPT · Claude · Gemini · Grok · ${Math.max(0, listCasualApps().length - 4)} more — the official status, in one place.`}</div>
      </div>
    ),
    { ...size, headers: { 'Cache-Control': OG_CACHE } }
  );
}
