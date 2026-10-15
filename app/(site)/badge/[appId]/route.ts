import { getCasualApp, getCasualStatus } from '@/lib/services/casual';
import { shortName, verdictKey } from '@/lib/ui/verdict';

// ISR so the thousands of page-loads an embedded badge generates are served from
// Next's cache, not a Firestore read each time. 5-min staleness is invisible on
// a status badge and matches the ingest cadence.
export const revalidate = 300;

const COLOR: Record<string, string> = {
  up: '#22c55e',
  wobbly: '#f59e0b',
  down: '#ef4444',
  unknown: '#9ca3af',
};
const RIGHT: Record<string, string> = {
  up: 'operational',
  wobbly: 'issues',
  down: 'down',
  unknown: 'unknown',
};

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// Rough text width for 11px Verdana; good enough for a tidy badge.
function w(s: string) {
  return Math.ceil(s.length * 6.7) + 12;
}

export async function GET(
  _req: Request,
  { params }: { params: { appId: string } | Promise<{ appId: string }> }
) {
  const resolved = await Promise.resolve(params as { appId: string });
  const id = resolved.appId.replace(/\.svg$/i, '').toLowerCase();
  const app = getCasualApp(id);

  let verdict = 'unknown';
  const label = app ? shortName(app.id, app.label) : id;
  if (app) {
    const status = await getCasualStatus({ appId: app.id }).catch(() => null);
    verdict = status ? verdictKey(status.overall_status) : 'unknown';
  }
  const right = RIGHT[verdict] || RIGHT.unknown;
  const color = COLOR[verdict] || COLOR.unknown;
  const lw = w(label);
  const rw = w(right);
  const total = lw + rw;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${esc(label)}: ${esc(right)}">
  <title>${esc(label)}: ${esc(right)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#0f172a"/>
    <rect x="${lw}" width="${rw}" height="20" fill="${color}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14.5" fill="#010101" fill-opacity=".3">${esc(label)}</text>
    <text x="${lw / 2}" y="13.5">${esc(label)}</text>
    <text x="${lw + rw / 2}" y="14.5" fill="#010101" fill-opacity=".3">${esc(right)}</text>
    <text x="${lw + rw / 2}" y="13.5">${esc(right)}</text>
  </g>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // App Hosting may downgrade `public` -> `private`, but ISR still serves the
      // heavy read from cache. These headers are the best client/CDN hint we can give.
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
