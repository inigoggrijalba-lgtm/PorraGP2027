// La app ya no se sirve desde esta dirección. Este archivo sustituye al que la guardaba en el móvil:
// borra lo guardado, se da de baja y recarga, para que quien entre por aquí llegue a la dirección nueva.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('porragp-')).map((k) => caches.delete(k)));
      await self.registration.unregister();
      const pages = await self.clients.matchAll({ type: 'window' });
      for (const page of pages) page.navigate(page.url).catch(() => {});
    })(),
  );
});
