self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'Clair de Lune';
  const url = data.url || '/';

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        data: { url },
      });

      if ('setAppBadge' in self.navigator) {
        try {
          if (data.unreadCount > 0) {
            await self.navigator.setAppBadge(data.unreadCount);
          } else {
            await self.navigator.clearAppBadge();
          }
        } catch {
          // Badging API unsupported/unavailable — ignore
        }
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const match = allClients.find((c) => new URL(c.url).pathname === url);
      if (match) {
        await match.focus();
      } else {
        await self.clients.openWindow(url);
      }
    })()
  );
});
