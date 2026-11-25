"use strict";
/* Service worker : l'app marche sans réseau, et reçoit les fichiers partagés depuis WhatsApp (Android). */
const VERSION = "nafuu-health-v10";
const SHELL = [
  "./", "./index.html", "./app.css", "./app.js", "./data.js", "./smart.js", "./codec.js", "./manifest.webmanifest",
  "./fonts/DejaVuSans.ttf", "./fonts/DejaVuSans-Bold.ttf",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png"
];
const SHARE_CACHE = "nafuu-health-partage";
const MAX_SHARE = 2 * 1024 * 1024;

self.addEventListener("install", (e) => {
  // cache: "reload" : on contourne le cache HTTP du navigateur, sinon une ancienne version peut être reprise.
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) =>
    fetch(new Request(u, { cache: "reload" })).then((r) => { if (!r.ok) throw new Error(u); return c.put(u, r); })
  ))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k !== VERSION && k !== SHARE_CACHE).map((k) => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (e.request.method === "POST" && url.pathname.endsWith("/partage")) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const f = form.get("fichier");
        if (f && typeof f.text === "function" && f.size <= MAX_SHARE) {
          const c = await caches.open(SHARE_CACHE);
          await c.put("./fichier-recu", new Response(await f.text(), { headers: { "Content-Type": "application/json" } }));
        }
      } catch (err) { /* fichier ignoré */ }
      return Response.redirect("./?partage=1", 303);
    })());
    return;
  }

  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
