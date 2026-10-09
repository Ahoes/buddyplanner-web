// MyBuddyPlanner: funcionamiento sin conexión.
// Al publicar una versión nueva, ejecuta npm run version (sube el número aquí, en index.html y en package.json).
const VERSION = 'mybuddyplanner-v0.1.31';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest',
  './css/styles.css', './js/engine.js', './js/ui.js', './js/compartir.js', './js/pwa.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' para no guardar copias viejas de la caché del navegador
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // la página, los estilos y los programas: primero internet (siempre la última versión, todos a la vez);
  // sin conexión, la copia guardada
  const url = new URL(req.url);
  const app = url.origin === self.location.origin && !url.pathname.includes('/icons/');
  if (req.mode === 'navigate' || app) {
    const clave = req.mode === 'navigate' ? './index.html' : req;
    // (una navegación no admite opciones: se pide por su dirección)
    const red = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
    e.respondWith(red.then((res) => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSION).then((c) => c.put(clave, copia)); }
      return res;
    }).catch(() => caches.match(clave).then((hit) => hit || caches.match(req, { ignoreSearch: true }))));
    return;
  }
  // iconos y tipografías: la copia guardada y, si no está, internet
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    const fuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (res.ok || (fuente && res.type === 'opaque')) {
      const copia = res.clone(); caches.open(VERSION).then((c) => c.put(req, copia));
    }
    return res;
  })));
});
