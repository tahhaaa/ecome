self.addEventListener('push', event => {
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Nouvelle commande Crooza', body: event.data?.text() || '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Crooza', {
    body: data.body || 'Une nouvelle commande est arrivée.',
    icon: '/images/crooza-mark.png',
    badge: '/images/crooza-mark.png',
    data: { url: data.url || '/admin' },
    tag: 'crooza-orders',
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || '/admin', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => client.url.startsWith(self.location.origin));
    return existing ? existing.navigate(destination).then(() => existing.focus()) : self.clients.openWindow(destination);
  }));
});
