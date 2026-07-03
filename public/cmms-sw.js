self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "CMMS CDSL";
  const options = {
    body: data.body || "יש עדכון חדש במערכת",
    tag: data.tag || "cmms-update",
    icon: "/pwa-icon.svg",
    badge: "/pwa-icon.svg",
    data: { url: data.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = allClients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if ("navigate" in existing) return existing.navigate(url);
      return;
    }
    await clients.openWindow(url);
  })());
});
