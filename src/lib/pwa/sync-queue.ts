// IndexedDB-backed sync queue for offline throw attempt logging.
// Queued items are automatically replayed when connectivity resumes.

import { openDB, idbGetAll, idbPut, idbDelete } from "./idb";

const STORE = "sync-queue";

export interface AttemptPayload {
  athleteId: string;
  event: string;
  implement: string;
  distance?: number;
  drillType?: string;
  coachNote?: string;
  videoUrl?: string;
  attemptNumber: number;
}

export interface QueuedAttempt {
  id: string;
  sessionId: string;
  payload: AttemptPayload;
  status: "pending" | "synced";
  createdAt: number;
  serverData?: unknown;
}

export interface SyncResult {
  queueId: string;
  success: boolean;
  serverData?: unknown;
  error?: string;
}

/**
 * Add an attempt to the offline sync queue.
 */
export async function queueAttempt(
  sessionId: string,
  payload: AttemptPayload
): Promise<QueuedAttempt> {
  const item: QueuedAttempt = {
    id: crypto.randomUUID(),
    sessionId,
    payload,
    status: "pending",
    createdAt: Date.now(),
  };

  const db = await openDB();
  await idbPut(db, STORE, item);
  db.close();

  // Try to register Background Sync (Chrome/Edge)
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration && "sync" in registration) {
      await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register("sync-attempts");
    }
  } catch {
    // Background Sync not supported (iOS Safari) — fallback handled by useSyncQueue
  }

  return item;
}

/**
 * Get all pending (unsynced) attempts, optionally filtered by sessionId.
 */
export async function getPendingAttempts(
  sessionId?: string
): Promise<QueuedAttempt[]> {
  const db = await openDB();
  const all = await idbGetAll<QueuedAttempt>(db, STORE);
  db.close();
  return all.filter(
    (item) =>
      item.status === "pending" && (!sessionId || item.sessionId === sessionId)
  );
}

/**
 * Get count of pending items.
 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  const all = await idbGetAll<QueuedAttempt>(db, STORE);
  db.close();
  return all.filter((item) => item.status === "pending").length;
}

/**
 * Mark an item as synced.
 */
export async function markSynced(
  id: string,
  serverData: unknown
): Promise<void> {
  const db = await openDB();
  const all = await idbGetAll<QueuedAttempt>(db, STORE);
  const item = all.find((a) => a.id === id);
  if (item) {
    item.status = "synced";
    item.serverData = serverData;
    await idbPut(db, STORE, item);
  }
  db.close();
}

/**
 * Remove a synced item from the queue.
 */
export async function removeSynced(id: string): Promise<void> {
  const db = await openDB();
  await idbDelete(db, STORE, id);
  db.close();
}

/**
 * Replay all pending items by POSTing to the server.
 * Returns results for each item.
 */
export async function replayQueue(): Promise<SyncResult[]> {
  const pending = await getPendingAttempts();
  const results: SyncResult[] = [];

  for (const item of pending) {
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
        await markSynced(item.id, data.data);
        // Clean up after brief delay (let UI react first)
        setTimeout(() => removeSynced(item.id), 2000);
        results.push({
          queueId: item.id,
          success: true,
          serverData: data.data,
        });
      } else {
        const errData = await response.json().catch(() => null);
        results.push({
          queueId: item.id,
          success: false,
          error: errData?.error || `HTTP ${response.status}`,
        });
      }
    } catch (err) {
      results.push({
        queueId: item.id,
        success: false,
        error: err instanceof Error ? err.message : "Network error",
      });
      // Stop replaying on network error — we're probably still offline
      break;
    }
  }

  return results;
}
