// Podium Throws — Service Worker
// Custom SW for offline-capable PWA (no workbox, no build tools)

const CACHE_VERSION = "podium-v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PAGES_CACHE = `pages-${CACHE_VERSION}`;
const OFFLINE_VIDEO_CACHE = "offline-videos";

// App shell resources to precache on install
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

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
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                key !== PAGES_CACHE &&
                key !== OFFLINE_VIDEO_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API routes — network only (sync queue handles offline)
  if (url.pathname.startsWith("/api/")) return;

  // Skip auth-related routes
  if (
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register")
  )
    return;

  // R2 video URLs — check offline-videos cache first, then network
  if (url.hostname.endsWith(".r2.dev")) {
    event.respondWith(
      caches.open(OFFLINE_VIDEO_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request);
        })
      )
    );
    return;
  }

  // Next.js immutable static assets — cache-first (hashed filenames, never stale)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // Navigation requests — network-first, fallback to offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigation responses
          const clone = response.clone();
          caches.open(PAGES_CACHE).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/offline.html"))
        )
    );
    return;
  }

  // Images and other static assets — stale-while-revalidate
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp")
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);

          return cached || networkFetch;
        })
      )
    );
    return;
  }
});

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
      const response = await fetch(
        `/api/throws/practice/${item.sessionId}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Mark as synced in IDB
        const dbWrite = await openIDB();
        const writeTx = dbWrite.transaction("sync-queue", "readwrite");
        const writeStore = writeTx.objectStore("sync-queue");
        item.status = "synced";
        item.serverData = data.data;
        writeStore.put(item);
        dbWrite.close();

        // Notify all clients about the successful sync
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
      // Network still down — leave as pending, SW will retry on next sync
    }
  }
}

// ── Message handler ─────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
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
