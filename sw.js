// MyBuddyPlanner: funcionamiento sin conexión.
// Al publicar una versión nueva, ejecuta npm run version (sube el número aquí, en index.html y en package.json).
const VERSION = 'mybuddyplanner-v0.1.13';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest',
  './css/styles.css', './js/engine.js', './js/ui.js', './js/pwa.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // la página: primero internet (para recibir actualizaciones); sin conexión, la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copia = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copia));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // iconos y tipografías: la copia guardada y, si no está, internet
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    const url = new URL(req.url);
    const fuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (res.ok || (fuente && res.type === 'opaque')) {
      const copia = res.clone(); caches.open(VERSION).then((c) => c.put(req, copia));
    }
    return res;
  })));
});
