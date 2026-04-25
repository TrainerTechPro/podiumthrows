// Minimal IndexedDB helper — shared by video cache + sync queue + quick-log queue + form drafts + generic outbox
// Database: podium-pwa, version 4
// Stores:
//   sync-queue       (keyPath: id)       — session throw attempts (legacy, coach practice)
//   offline-videos   (keyPath: videoId)  — cached video blobs
//   quick-log-queue  (keyPath: clientId) — Quick Log throws pending sync
//   form-drafts      (keyPath: key)      — in-progress form data, keyed `${userId}:${formKey}:${entityId?}`
//   outbox           (keyPath: id)       — generic mutation queue for forms b–f, envelope-shaped

const DB_NAME = "podium-pwa";
const DB_VERSION = 4;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // v1 stores
      if (!db.objectStoreNames.contains("sync-queue")) {
        db.createObjectStore("sync-queue", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("offline-videos")) {
        db.createObjectStore("offline-videos", { keyPath: "videoId" });
      }
      // v2: quick-log queue
      if (!db.objectStoreNames.contains("quick-log-queue")) {
        const store = db.createObjectStore("quick-log-queue", { keyPath: "clientId" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      // v3: form drafts (in-progress form fields, survives crash/reload)
      if (!db.objectStoreNames.contains("form-drafts")) {
        const store = db.createObjectStore("form-drafts", { keyPath: "key" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
      // v4: generic outbox (envelope-shaped: url, method, bodyJson, idempotencyKey, ...)
      if (!db.objectStoreNames.contains("outbox")) {
        const store = db.createObjectStore("outbox", { keyPath: "id" });
        store.createIndex("nextAttemptAt", "nextAttemptAt", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function idbGet<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export function idbGetAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export function idbPut<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function idbDelete(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function idbCount(db: IDBDatabase, storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
