const CACHE_PREFIX = "solo-sales-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v4`;
const APP_ROOT = "/";

async function cacheShellAssets(cache, html) {
  const pending = new Set([
    ...[...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map(
      (match) => match[1],
    ),
    "/assets/images/logo.png",
    "/manifest.webmanifest",
    "/icons/app-192.png",
    "/icons/app-512.png",
  ]);
  const visited = new Set();

  while (pending.size) {
    const path = pending.values().next().value;
    pending.delete(path);
    if (visited.has(path)) continue;
    visited.add(path);

    const url = new URL(path, self.location.origin);
    if (
      url.origin !== self.location.origin ||
      !["/assets/", "/icons/", "/manifest.webmanifest"].some((prefix) =>
        url.pathname.startsWith(prefix),
      )
    ) {
      continue;
    }

    const response = await fetch(url);
    if (!response.ok) continue;
    const copy = response.clone();
    await cache.put(url, copy);

    if (url.pathname.endsWith(".css")) {
      const css = await response.text();
      for (const match of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
        if (!match[1].startsWith("data:")) pending.add(match[1]);
      }
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const response = await fetch(APP_ROOT, { cache: "reload" });
      if (response.ok) {
        await cache.put(APP_ROOT, response.clone());
        await cacheShellAssets(cache, await response.text());
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(APP_ROOT, response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(APP_ROOT)) || Response.error()),
    );
    return;
  }

  if (
    !["/assets/", "/icons/"].some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url.pathname, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});
