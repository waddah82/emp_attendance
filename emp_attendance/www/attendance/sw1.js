const CACHE_NAME = "emp-attendance-v1";
const ASSETS = [
  "/emp_attendance",
  "/attendance/",
  "/attendance/manifest.webmanifest",
  "/assets/emp_attendance/attendance/style.css",
  "/assets/emp_attendance/attendance/app.js",
  "/assets/emp_attendance/attendance/icon-192.png",
  "/assets/emp_attendance/attendance/icon-512.png",
  "/assets/emp_attendance/attendance/hero.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))))
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API -> network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // static -> cache-first
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
