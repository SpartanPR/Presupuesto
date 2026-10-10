// Service worker de Presupuesto Familiar.
// Para publicar una versión nueva de la app, cambia VERSION (o solo sube el index.html: se recarga solo desde la red).
const VERSION = 'v2-2026-10-10';
const CACHE = 'presupuesto-' + VERSION;
const SHELL = ['./', './index.html', './esposa.html', './manifest.webmanifest', './manifest-esposa.webmanifest',
               './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La sincronización siempre va directo a la red: nunca se guarda en caché.
  if (url.hostname.includes('jsonblob.com')) return;

  // Páginas: primero la red (para ver siempre la última versión); sin internet, la copia guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Resto (iconos, tipografías): lo guardado al instante y se refresca en segundo plano.
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (sameOrigin || isFont) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
