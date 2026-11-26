/* Minimal service worker for the IS PWA.
   - App shell + static assets (/_next/static, /icons, manifest):
     cache-first, so repeat visits and offline opens stay instant.
   - Pages and API calls (/api/*): network-first, never cached —
     replies, auth and copy history must always be live.
   - Anything else: network first, cache as a fallback.
   Version the cache so a new deploy replaces the old shell. */

const CACHE = "is-cache-v6"; /* v6 (2026-11-27): التطوير الشامل — اختصارات على الرئيسية + صور متعددة (لحد 3) — يضمن وصول البناء الجديد للمستخدمين بدل نسخة مخزنة قديمة */
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/icons\//, /^\/manifest\.webmanifest$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add("/"))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  // Never cache API traffic or the page shell itself beyond the install precache.
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  if (STATIC_PATTERNS.some((re) => re.test(url.pathname))) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ??
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          }),
      ),
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (url.pathname === "/") {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});
