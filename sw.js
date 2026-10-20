/* Service worker: guarda la app y el mapa para usarlos sin internet */
const VERSION = 'monitoreo-app-v1';
const MAPA = 'mapa-v1';
const APP = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];
const HOSTS_MAPA = ['server.arcgisonline.com', 'tile.openstreetmap.org', 'a.tile.opentopomap.org'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== MAPA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // El envío y la lista de beneficiarios siempre van directo a Google
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  // Imágenes del mapa: primero lo guardado, si no, internet (y se guarda)
  if (HOSTS_MAPA.includes(url.hostname)) {
    e.respondWith(caches.open(MAPA).then(async (c) => {
      const guardada = await c.match(req.url);
      if (guardada) return guardada;
      try {
        const r = await fetch(req);
        if (r.ok) c.put(req.url, r.clone());
        return r;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    }));
    return;
  }

  // La app: responde con lo guardado y actualiza en segundo plano
  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((guardada) => {
      const red = fetch(req).then((r) => {
        if (r.ok && (url.origin === self.location.origin || url.hostname === 'cdnjs.cloudflare.com')) {
          const copia = r.clone();
          caches.open(VERSION).then((c) => c.put(req, copia));
        }
        return r;
      }).catch(() => guardada || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
      return guardada || red;
    })
  );
});
