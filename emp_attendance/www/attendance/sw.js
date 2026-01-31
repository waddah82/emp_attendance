// Service Worker for EMP Attendance PWA
const CACHE_NAME = "emp-attendance-v1.0.3";

const ASSETS_TO_CACHE = [
  "/attendance/",
  "/attendance/index.html",
  "/attendance/manifest.webmanifest",
  "/assets/emp_attendance/attendance/style.css",
  "/assets/emp_attendance/attendance/app.js",
  "/assets/emp_attendance/attendance/icon-192.png",
  "/assets/emp_attendance/attendance/icon-512.png"
];

// Install Event
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // cache one-by-one (so one failure doesn't break install)
    await Promise.all(
      ASSETS_TO_CACHE.map(async (url) => {
        try {
          const res = await fetch(new Request(url, { cache: "reload" }), { redirect: "follow" });
          if (res && res.ok) await cache.put(url, res.clone());
        } catch (e) {
          // ignore single file errors
        }
      })
    );
  })());
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// Fetch
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for API calls
  if (url.pathname.includes("/api/method/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation: fallback to cached index
  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(event.request);
      } catch (e) {
        return await caches.match("/attendance/index.html");
      }
    })());
    return;
  }

  // Static assets: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    const fresh = await fetch(event.request);
    if (url.origin === self.location.origin) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, fresh.clone());
    }
    return fresh;
  })());
});
