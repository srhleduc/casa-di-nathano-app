// Service worker minimal, dédié aux notifications push de l'espace Direction
// (alerte "embouteillage four"). N'intervient pas dans le fonctionnement de
// la borne/l'espace équipe, qui ne l'enregistrent pas.

self.addEventListener("push", (event) => {
  let data = { title: "Casa Di Nathano", body: "" };
  try {
    data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Casa Di Nathano", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
