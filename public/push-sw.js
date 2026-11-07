/* Phone notifications for PRISM, the PHILRADS staff system (loaded into the service worker). */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : 'PRISM' };
  }
  const title = data.title || 'PRISM';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/favicon-32x32.png',
      tag: data.id || undefined,
      data: { url: data.url || '/' },
      vibrate: [80, 40, 80],
    }),
  );
});

// Tapping it opens the portal at the right page (an open window is reused).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = list.find((c) => c.url.startsWith(self.location.origin));
      if (open) {
        try {
          await open.focus();
          open.postMessage({ type: 'prism:open', url });
          return;
        } catch {
          /* couldn't bring it forward: open a new window below */
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
