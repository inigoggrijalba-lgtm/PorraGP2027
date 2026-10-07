// Guarda la app para que abra al instante y sin cobertura. Los datos siempre se piden a la red.
const VERSION = '%VERSION%';
const CACHE = `porragp-${VERSION}`;
const SHELL = ['./', './index.html', '%APP_JS%', '%APP_CSS%', './manifest.webmanifest', './icon.svg', './icon-192.png', './badge-96.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('porragp-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Aviso recibido: se enseña aunque la app esté cerrada.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'PorraGP', {
        body: data.body || '',
        tag: data.tag || undefined,
        renotify: !!data.tag,
        icon: './icon-192.png',
        badge: './badge-96.png',
        data: { url: data.url || '' },
      }),
      // Si la app está abierta, se le dice que el aviso ha llegado (sirve para confirmar la prueba).
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const c of list) c.postMessage({ type: 'push-received', tag: data.tag || '' });
      }),
    ]),
  );
});

// Al tocar el aviso se abre la app en la pantalla que toca (votar, puntos, resultados...).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const hash = (event.notification.data && event.notification.data.url) || '';
  const target = self.registration.scope + hash;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (open) {
        open.postMessage({ type: 'go', hash });
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Tipografías y fotos de pilotos: se guardan para que no haya que volver a bajarlas.
  const kept = ['fonts.googleapis.com', 'fonts.gstatic.com', 'wsrv.nl'].includes(url.hostname);
  if (!sameOrigin && !kept) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
