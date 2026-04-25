// Podium Throws — Service Worker (v2)
// Hand-rolled, no workbox. Strategy table is documented in CLAUDE.md and the
// PWA proposal in tasks/. Bumping CACHE_VERSION evicts every prior cache on
// activate — that is the only knob you need to turn for asset busts.

const CACHE_VERSION = "podium-v2";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PAGES_CACHE = `pages-${CACHE_VERSION}`;
const IMAGES_CACHE = `images-${CACHE_VERSION}`;
const API_ATHLETE_CACHE = `api-athlete-${CACHE_VERSION}`;
const OFFLINE_VIDEO_CACHE = "offline-videos"; // unversioned — user-curated downloads

const ACTIVE_CACHES = new Set([
  STATIC_CACHE,
  PAGES_CACHE,
  IMAGES_CACHE,
  API_ATHLETE_CACHE,
  OFFLINE_VIDEO_CACHE,
]);

// App shell precache. Kept tight on purpose — the SW is not a CDN.
const PRECACHE_URLS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];

// Cache-size caps. Beyond these we evict oldest-first.
const IMAGES_MAX_ENTRIES = 80;
const IMAGES_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const API_ATHLETE_MAX_ENTRIES = 50;
const API_ATHLETE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const API_NETWORK_TIMEOUT_MS = 5000;

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !ACTIVE_CACHES.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Mutations and non-GET: never touched by the SW. Outbox + sync-attempts
  // queue handle offline. Letting them through to network preserves CSRF
  // headers, cookies, and request bodies untouched.
  if (request.method !== "GET") return;

  // Auth + Stripe + CSRF: never cache, never intercept.
  if (
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register") ||
    url.pathname.startsWith("/api/auth/") ||
    url.pathname.startsWith("/api/csrf") ||
    url.pathname.startsWith("/api/stripe/")
  ) {
    return;
  }

  // Cross-origin (R2 video, third-party): skip everything except the explicit
  // offline-videos cache below.
  const sameOrigin = url.origin === self.location.origin;

  // R2 athlete videos — user-curated offline downloads land in
  // OFFLINE_VIDEO_CACHE; the OfflineVideoButton is what populates this.
  if (url.hostname.endsWith(".r2.dev")) {
    event.respondWith(
      caches.open(OFFLINE_VIDEO_CACHE).then((cache) =>
        cache.match(request).then((cached) => cached || fetch(request))
      )
    );
    return;
  }

  if (!sameOrigin) return;

  // Next.js immutable hashed assets — cache-first. Hashes are the bust.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Manifest + icons + precached app shell — cache-first.
  if (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/offline"
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Athlete API GETs — network-first with 5s timeout, fallback to cache,
  // fallback to soft-offline JSON the client can render as an empty state.
  if (
    url.pathname.startsWith("/api/athlete/") ||
    url.pathname.startsWith("/api/training/") ||
    url.pathname.startsWith("/api/throws/practice/")
  ) {
    event.respondWith(networkFirstWithTimeout(request, API_ATHLETE_CACHE));
    return;
  }

  // Other API GETs — network-only. We don't want to surprise other surfaces
  // (coach, admin, billing) with stale reads.
  if (url.pathname.startsWith("/api/")) return;

  // Same-origin images — cache-first with 30-day LRU.
  const isImage =
    /\.(?:png|jpe?g|webp|svg|avif|gif)$/i.test(url.pathname) ||
    request.destination === "image";
  if (isImage) {
    event.respondWith(cacheFirstWithLRU(request, IMAGES_CACHE, IMAGES_MAX_ENTRIES, IMAGES_TTL_MS));
    return;
  }

  // Navigation requests — stale-while-revalidate, with /offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(request, PAGES_CACHE));
    return;
  }
});

// ── Cache strategies ─────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(async () => {
      // Network failed — return cached if we have it, otherwise the offline page.
      if (cached) return cached;
      const offline = await caches.match("/offline");
      return offline || new Response("Offline", { status: 503, statusText: "Offline" });
    });

  return cached || networkPromise;
}

async function networkFirstWithTimeout(request, cacheName) {
  const cache = await caches.open(cacheName);

  let didTimeout = false;
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      didTimeout = true;
      resolve(null);
    }, API_NETWORK_TIMEOUT_MS);
  });

  try {
    const networkResponse = await Promise.race([fetch(request), timeoutPromise]);

    if (networkResponse && networkResponse.ok) {
      // Stamp + store
      const stamped = await stampedClone(networkResponse);
      cache.put(request, stamped);
      enforceLRU(cache, API_ATHLETE_MAX_ENTRIES);
      return networkResponse;
    }

    // Network returned non-ok or timed out — fall through to cache.
    if (didTimeout || !networkResponse) {
      const cached = await cache.match(request);
      if (cached && !isStale(cached, API_ATHLETE_TTL_MS)) return cached;
      // Last resort: stale cache is better than nothing if it exists.
      if (cached) return cached;
    }
    return networkResponse || softOfflineJson();
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return softOfflineJson();
  }
}

async function cacheFirstWithLRU(request, cacheName, maxEntries, ttlMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached && !isStale(cached, ttlMs)) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const stamped = await stampedClone(response);
      cache.put(request, stamped);
      enforceLRU(cache, maxEntries);
    }
    return response;
  } catch (err) {
    if (cached) return cached; // serve stale on offline
    throw err;
  }
}

// ── Cache hygiene ────────────────────────────────────────────────────────────

// Wrap a Response with a `sw-cached-at` header so we can compute age later.
async function stampedClone(response) {
  const headers = new Headers(response.headers);
  headers.set("sw-cached-at", String(Date.now()));
  const body = await response.clone().blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isStale(response, ttlMs) {
  const ts = parseInt(response.headers.get("sw-cached-at") || "0", 10);
  if (!ts) return false; // no stamp → assume fresh enough; next fetch will restamp
  return Date.now() - ts > ttlMs;
}

// FIFO eviction. cache.keys() returns in insertion order, so dropping the
// oldest N is sufficient. We don't need a true LRU — adding cost to bookkeep
// access order on every read defeats the purpose of a fast cache.
async function enforceLRU(cache, maxEntries) {
  const keys = await cache.keys();
  const overflow = keys.length - maxEntries;
  if (overflow <= 0) return;
  for (let i = 0; i < overflow; i++) {
    await cache.delete(keys[i]);
  }
}

function softOfflineJson() {
  return new Response(
    JSON.stringify({
      success: false,
      error: "offline",
      message: "Network unavailable. Showing cached data where possible.",
    }),
    {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "application/json", "X-Podium-Offline": "1" },
    }
  );
}

// ── Background Sync — replay queued throw attempts ──────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-attempts") {
    event.waitUntil(replayAttemptQueue());
  }
});

async function replayAttemptQueue() {
  const db = await openIDB();
  const tx = db.transaction("sync-queue", "readonly");
  const store = tx.objectStore("sync-queue");
  const items = await idbGetAll(store);
  db.close();

  for (const item of items) {
    if (item.status !== "pending") continue;
    try {
      const response = await fetch(`/api/throws/practice/${item.sessionId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      if (response.ok) {
        const data = await response.json();
        const dbWrite = await openIDB();
        const writeTx = dbWrite.transaction("sync-queue", "readwrite");
        const writeStore = writeTx.objectStore("sync-queue");
        item.status = "synced";
        item.serverData = data.data;
        writeStore.put(item);
        dbWrite.close();

        const clients = await self.clients.matchAll();
        for (const client of clients) {
          client.postMessage({
            type: "SYNC_COMPLETE",
            queueId: item.id,
            serverData: data.data,
          });
        }
      }
    } catch {
      // Network still down — leave as pending, SW retries on next sync event.
    }
  }
}

// ── Message handler ─────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Web Push — receive notifications from the server ───────────────────────
// Payload shape (from src/lib/push.ts): { title, body, url?, tag?, data? }
self.addEventListener("push", (event) => {
  let payload = { title: "Podium Throws", body: "" };
  try {
    if (event.data) {
      payload = Object.assign(payload, event.data.json());
    }
  } catch {
    try {
      if (event.data) payload.body = event.data.text();
    } catch {
      // ignore
    }
  }

  const options = {
    body: payload.body,
    tag: payload.tag || "podium-throws",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/", ...(payload.data || {}) },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// ── Notification click — focus an existing tab or open a new one ───────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            try {
              client.navigate(targetUrl);
            } catch {
              // Cross-origin or other navigation issues — ignore
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── IndexedDB helpers (duplicated here because SW can't import modules) ─────
function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("podium-pwa", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("sync-queue")) {
        db.createObjectStore("sync-queue", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("offline-videos")) {
        db.createObjectStore("offline-videos", { keyPath: "videoId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
