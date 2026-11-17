// Two API families that were removed in the August 2026 rebuild
// (`/api/public/v1/status/*`, `/api/public/v1/incidents/*`) still take ~50k
// requests a day from one automated client that ignores the 410.
//
// On Firebase App Hosting any route matched by middleware is never CDN-cached,
// so these two paths are excluded from the middleware matcher and answered
// here with an explicitly public Cache-Control: the CDN absorbs the repeats and
// the container never sees them. (Answering from middleware, as before, sent
// every one of them to the origin marked `private`.)
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
