/* mierdasdelmundo service worker: offline app shell + cached libraries. Map tiles and cloud sync stay network-only. */
const CACHE = 'mierdasdelmundo-v9';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  './assets/mascot.png', './assets/bag.png', './assets/cam.png', './assets/map.png', './assets/book.png', './assets/av/0.png', './assets/av/1.png', './assets/av/2.png', './assets/av/3.png', './assets/av/4.png', './assets/av/5.png', './assets/av/6.png', './assets/av/7.png', './assets/av/8.png', './assets/badge/first.png', './assets/badge/ten.png', './assets/badge/fifty.png', './assets/badge/hundred.png', './assets/badge/night.png', './assets/badge/dawn.png', './assets/badge/streak3.png', './assets/badge/streak7.png', './assets/badge/shiny.png', './assets/badge/legend.png', './assets/badge/explorer.png', './assets/badge/globe.png', './assets/badge/collector.png', './assets/badge/bigone.png', './assets/badge/archaeo.png', './assets/badge/cities3.png', './assets/badge/cities10.png', './assets/badge/master.png',
  './assets/badge/kinds5.png', './assets/badge/cars10.png', './assets/badge/locks10.png', './assets/badge/cones10.png', './assets/badge/trash10.png', './assets/badge/cleaner10.png', './assets/kind/car.png', './assets/kind/lock.png', './assets/kind/cone.png', './assets/kind/trash.png'];

self.addEventListener('install', e => {
  // Precache the shell one file at a time: a single missing file must not block the install.
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App shell: network first (so updates land on reload), cache as fallback.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(m => m || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
    return;
  }

  // Leaflet (unpkg), the QR library (cdnjs) and the face detector (jsdelivr + its model on googleapis): cache first, so they work offline after the first load.
  if (/(^|\.)(unpkg\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|storage\.googleapis\.com)$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(m => m || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => new Response('', { status: 504, statusText: 'offline' })))
    );
  }
  // Everything else (OSM tiles, Firebase): default network behaviour.
});
