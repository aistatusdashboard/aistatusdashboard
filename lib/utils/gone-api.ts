// Two API families that were removed in the August 2026 rebuild
// (`/api/public/v1/status/*`, `/api/public/v1/incidents/*`) still take ~50k
// requests a day from one automated client that ignores the 410.
//
// This used to be answered from middleware, but on Firebase App Hosting any
// route matched by middleware is never CDN-cached ("Routes affected by Next.js
// middleware aren't cached"), and the matcher covered the whole site — so every
// one of those calls, and every page view, reached the container. Answering
// from a plain route handler with an explicitly public Cache-Control lets the
// CDN absorb the repeats.
export function goneResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'Gone', hint: 'The public API lives under /api/public/v1/casual/.' }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    }
  );
}
