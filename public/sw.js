// Minimal service worker for offline shell + installability.
// Cache strategy: network-first for navigations, fall back to a
// cached "/" shell on offline. Static assets (CSS/JS/fonts/images)
// are left to the platform's HTTP cache — Cloudflare + Next handle
// them well enough that a custom strategy would just risk staleness.
//
// Bumped on every meaningful SW logic change so old workers
// activate-and-die cleanly via the cleanup pass in `activate`.

const CACHE_VERSION = "briefly-shell-v1";
const SHELL_URLS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        await cache.addAll(SHELL_URLS);
      } catch {
        // Network may be flaky on first install; failing here would
        // block install entirely. Skip — fetch handler will
        // populate on subsequent navigation.
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put("/", fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match("/");
        if (cached) return cached;
        return new Response(
          "<!doctype html><meta charset=utf-8><title>Offline</title><body style=\"font-family:system-ui;background:#0A0A0A;color:#fff;display:grid;place-items:center;height:100vh;margin:0\"><div style=\"text-align:center\"><h1>You're offline</h1><p>Reconnect and try again.</p></div></body>",
          { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
        );
      }
    })()
  );
});
