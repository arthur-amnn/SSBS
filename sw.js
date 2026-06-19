/* =====================================================================
   sw.js — Service Worker (worker classique, pas de module : compat iOS).
   Strategie : precache de la coquille de l'app au install, puis
   "cache-first" pour fonctionner totalement hors-ligne en salle.
   Bump CACHE a chaque release pour invalider l'ancien cache.
   ===================================================================== */
const CACHE = 'ssbs-v10';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/app.js',
  './js/engine.js',
  './js/program.js',
  './js/storage.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => { /* si un asset manque, on installe quand meme le reste */ })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // on ne gere que le local

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // rafraichit en arriere-plan (stale-while-revalidate light)
        fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(res => {
        if (res && res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() =>
        // repli : si navigation hors-ligne, sert l'app
        req.mode === 'navigate' ? caches.match('./index.html') : Response.error()
      );
    })
  );
});
