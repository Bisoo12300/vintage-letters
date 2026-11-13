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
        // Same tag replaces instead of stacking (e.g. one reminder per event/stage)
        ...(data.tag ? { tag: data.tag } : {}),
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
      // Reuse an open tab of the app and take it to the link (the link may carry a query, e.g.
      // /pets?checkin=1); only open a new window when the app isn't open at all.
      const target = new URL(url, self.location.origin).href;
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = allClients.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        const focused = await client.focus();
        if (focused.url !== target && 'navigate' in focused) await focused.navigate(target);
      } else {
        await self.clients.openWindow(target);
      }
    })()
  );
});
