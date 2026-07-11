self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  if (["doc", "pm", "ppe"].includes(data.kind)) return;
  if (typeof data.tag === "string" && (data.tag.startsWith("sh-on-") || data.tag.startsWith("sh-off-"))) return;
  const title = data.title || "CMMS CDSL";
  const options = {
    body: data.body || "יש עדכון חדש במערכת",
    tag: data.tag || "cmms-update",
    icon: "/pwa-icon.svg?v=brand-20260711",
    badge: "/pwa-icon.svg?v=brand-20260711",
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
