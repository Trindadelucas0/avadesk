const CACHE = "avadesk-shell-v6";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(["/manifest.webmanifest"]).then(() => self.skipWaiting())
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))).then(() =>
        self.clients.claim()
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  const accept = request.headers.get("accept") || "";
  const isPage =
    request.mode === "navigate" ||
    request.destination === "document" ||
    accept.includes("text/html") ||
    url.pathname === "/" ||
    url.pathname === "/login";

  if (isPage) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status < 400) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

/** Keep in sync with `apps/web/src/lib/push-open.ts`. */
function isSafePushHref(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 300) return false;
  if (raw.charAt(0) !== "/" || raw.indexOf("//") === 0) return false;
  if (raw.indexOf("\\") !== -1 || raw.indexOf("://") !== -1) return false;
  if (/[\r\n\t]/.test(raw)) return false;
  return true;
}

function sanitizePushHref(href) {
  const raw = String(href || "").trim();
  if (isSafePushHref(raw)) return raw;
  if (raw.indexOf("/admin") === 0) return "/admin";
  if (raw.indexOf("/client") === 0) return "/client";
  return "/";
}

function appendPushOpenQuery(href, payload) {
  const url = new URL(href, self.location.origin);
  if (payload.id) url.searchParams.set("fromPush", String(payload.id).slice(0, 36));
  const title = String(payload.title || "").slice(0, 200);
  const body = String(payload.body || "").slice(0, 500);
  if (title) url.searchParams.set("pt", title);
  if (body) url.searchParams.set("pb", body);
  return url.pathname + url.search + url.hash;
}

async function handlePush(event) {
  let data = { title: "Avadesk", body: "Nova atualização", href: "/", id: "" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : "";
      if (text) data.body = String(text).slice(0, 500);
    } catch {
      /* ignore */
    }
  }
  const title = data.title || "Avadesk";
  const body = data.body || "Nova atualização";
  const href = sanitizePushHref(data.href || "/");
  const id = data.id || "";
  const payload = { href, title, body, id };
  const ua = self.navigator && self.navigator.userAgent ? self.navigator.userAgent : "";
  const ios = /iPad|iPhone|iPod/i.test(ua);
  const base = {
    body,
    icon: "/icons/icon-192.png",
    data: payload,
  };
  const full = {
    ...base,
    badge: "/icons/icon-192.png",
    vibrate: [200, 100, 200],
    tag: id ? String(id).slice(0, 64) : "avadesk-push",
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
  };
  try {
    await self.registration.showNotification(title, ios ? base : full);
  } catch {
    await self.registration.showNotification(title, { body, data: payload });
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const title = data.title || event.notification.title || "Avadesk";
  const body = data.body || event.notification.body || "Nova atualização";
  const id = data.id || "";
  const safePath = sanitizePushHref(data.href || "/");
  const target = appendPushOpenQuery(safePath, { id, title, body });
  const openUrl = new URL(target, self.location.origin).href;
  const payload = { type: "AVADESK_PUSH_OPEN", id, title, body, href: safePath };

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) {
            return client.navigate(openUrl).then((c) => {
              const next = c || client;
              if (next && "postMessage" in next) next.postMessage(payload);
              return next && "focus" in next ? next.focus() : client.focus();
            });
          }
          if ("postMessage" in client) client.postMessage(payload);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(openUrl);
    })
  );
});
