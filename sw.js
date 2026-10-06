'use strict';
// Change CACHE with every deploy (and keep it equal to VERSION in app.js), or phones keep the old version.
const CACHE = 'training-tracker-0.3.0';
const FILES = [
  './', 'styles.css', 'theme.js', 'logic.js', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

// Some hosts redirect /index.html to /. A cached redirected response makes Safari refuse the page.
const plain = (res) => res.redirected
  ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
  : res;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(FILES.map((f) =>
        fetch(new Request(f, { cache: 'reload' })).then((r) => {
          if (!r.ok) throw new Error('Precache failed: ' + f);
          return c.put(f, plain(r));
        }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = req.mode === 'navigate' ? './' : req;
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return plain(hit);
    try {
      const res = await fetch(req);
      if (res.ok && req.mode !== 'navigate') cache.put(req, res.clone());
      return res;
    } catch {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
