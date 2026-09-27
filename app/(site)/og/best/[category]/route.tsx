import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LABELS: Record<string, string> = {
  'ai-chatbot': 'AI chatbot',
  'ai-coding-assistant': 'AI coding assistant',
  'ai-image-generator': 'AI image generator',
  'ai-video-generator': 'AI video generator',
  'ai-writing-assistant': 'AI writing assistant',
};

export async function GET(_req: Request, { params }: { params: { category: string } | Promise<{ category: string }> }) {
  const resolved = await Promise.resolve(params as { category: string });
  const label = LABELS[resolved.category];
  if (!label) return new Response('Not found', { status: 404 });
  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: '#0f172a' }}>
        <div style={{ fontSize: 40, color: '#94a3b8' }}>Most reliable</div>
        <div style={{ fontSize: 84, fontWeight: 700, color: '#f8fafc', marginTop: 8 }}>{label}</div>
        <div style={{ fontSize: 32, color: '#34d399', marginTop: 24 }}>Ranked by 30-day uptime · aistatusdashboard.com</div>
      </div>
    ),
    size
  );
}
