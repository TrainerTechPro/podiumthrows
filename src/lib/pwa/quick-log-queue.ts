/**
 * Quick Log offline queue — IndexedDB-backed queue for throws logged while offline.
 *
 * Uses the shared `podium-pwa` database (version 2) with the `quick-log-queue` store.
 * Throws are queued with a stable clientId (UUID) for deduplication on sync.
 *
 * When back online, call syncQuickLogQueue() to replay all pending entries.
 */

import { openDB, idbGetAll, idbPut, idbDelete, idbCount } from "./idb";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";

const STORE = "quick-log-queue";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueuedThrow {
  clientId: string; // UUID — stable identifier for dedup
  event: string;
  implementWeight: number;
  distance?: number;
  feeling?: string;
  notes?: string;
  createdAt: number; // Date.now() timestamp
}

export interface SyncResult {
  synced: number;
  failed: number;
}

// ── Queue Operations ──────────────────────────────────────────────────────────

/**
 * Add a Quick Log throw to the offline queue.
 * Safe to call even when online — just queues for immediate or deferred sync.
 */
export async function queueQuickLogThrow(payload: QueuedThrow): Promise<void> {
  const db = await openDB();
  await idbPut<QueuedThrow>(db, STORE, payload);
  db.close();

  // Request Background Sync if available (Chrome/Edge/Android)
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration && "sync" in registration) {
      await (
        registration as ServiceWorkerRegistration & {
          sync: { register(tag: string): Promise<void> };
        }
      ).sync.register("sync-quick-log");
    }
  } catch (err) {
    // Background Sync not supported (iOS Safari) — syncQuickLogQueue() handles it on reconnect
    logger.debug(
      "Background Sync not supported (iOS Safari) — syncQuickLogQueue() handles it on reconnect",
      {
        context: "src/lib/pwa/quick-log-queue.ts",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      }
    );
  }
}

/**
 * Returns all pending throws, ordered by createdAt ascending (oldest first).
 */
export async function getPendingQuickLogThrows(): Promise<QueuedThrow[]> {
  const db = await openDB();
  const all = await idbGetAll<QueuedThrow>(db, STORE);
  db.close();
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Remove a throw from the queue after successful sync.
 */
export async function removeQuickLogThrow(clientId: string): Promise<void> {
  const db = await openDB();
  await idbDelete(db, STORE, clientId);
  db.close();
}

/**
 * Count of pending throws in the queue.
 */
export async function getPendingQuickLogCount(): Promise<number> {
  const db = await openDB();
  const count = await idbCount(db, STORE);
  db.close();
  return count;
}

/**
 * Sync all pending throws to the server.
 * Iterates oldest-first, POSTing each to /api/athlete/quick-log.
 * Successfully synced throws are removed from the queue.
 * Stops on the first network error (still offline).
 *
 * Returns { synced, failed } counts.
 */
export async function syncQuickLogQueue(): Promise<SyncResult> {
  const pending = await getPendingQuickLogThrows();

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const response = await fetch("/api/athlete/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          event: item.event,
          implementWeight: item.implementWeight,
          distance: item.distance ?? null,
          feeling: item.feeling ?? null,
          notes: item.notes ?? null,
        }),
      });

      if (response.ok) {
        await removeQuickLogThrow(item.clientId);
        synced++;
      } else {
        // Server error (e.g. 400/500) — remove to avoid infinite retry loops
        // on permanent errors; keep on transient (408/429/503)
        const status = response.status;
        if (status < 500 && status !== 408 && status !== 429) {
          // Permanent client error — remove from queue
          await removeQuickLogThrow(item.clientId);
        }
        failed++;
      }
    } catch {
      // Network error — stop syncing, we're probably still offline
      failed++;
      break;
    }
  }

  return { synced, failed };
}
