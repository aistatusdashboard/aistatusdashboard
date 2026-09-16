import { ImageResponse } from 'next/og';
import { getLivePulseSnapshot } from '@/lib/services/live-pulse';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
        <div style={{ marginTop: 20, fontSize: 30, color: '#cbd5e1' }}>ChatGPT · Claude · Gemini · Grok · 22 more — the official status, in one place.</div>
      </div>
    ),
    size
  );
}
