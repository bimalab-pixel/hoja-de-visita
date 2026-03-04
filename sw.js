/* ═══════════════════════════════════════════════
   MINSAL Visitas Domiciliares — Service Worker
   Modo offline completo. Actualiza CACHE_NAME
   si cambias el index.html para forzar recarga.
═══════════════════════════════════════════════ */

const CACHE_NAME = 'minsal-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap',
];

/* No cachear peticiones a Firebase */
const SKIP_CACHE = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'gstatic.com/firebasejs',
  'identitytoolkit',
];

/* ── Instalar: pre-cachear todo ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS).catch(err => console.warn('[SW] Cache parcial:', err)))
      .then(() => self.skipWaiting())
  );
});

/* ── Activar: borrar caches viejos ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: Cache-first para assets, red para Firebase ── */
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase y CDNs externos: dejar pasar sin cachear
  if(SKIP_CACHE.some(p => url.includes(p))) return;

  // Navegación (HTML): red primero, cache como fallback
  if(e.request.mode === 'navigate'){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Todo lo demás: cache primero
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(res => {
        if(!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => console.warn('[SW] Sin red:', url));
    })
  );
});

/* ── Mensaje para forzar actualización ── */
self.addEventListener('message', e => {
  if(e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
