// Service worker retired. A live status site has no useful offline mode, and
// the old caching SW risked serving stale verdicts / breaking hydration.
// This kill-switch unregisters any previously installed SW and clears its
// caches, then goes away. Kept as a valid file so existing installs update to
// it instead of holding the old one.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {}
      await self.registration.unregister();
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});
// Never intercept fetches — everything goes straight to network.
