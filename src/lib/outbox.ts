"use client";

import { useEffect, useState } from "react";
import { openDB, idbGetAll, idbPut, idbDelete, idbCount } from "@/lib/pwa/idb";
import { csrfHeaders } from "@/lib/csrf-client";
import { useOnlineStatus } from "@/lib/pwa/online-status";
import { logger } from "@/lib/logger";

/**
 * Generic mutation outbox for forms b–f.
 *
 * Forms call `enqueueMutation()` when their submit fetch fails on a network
 * error. The envelope (URL, method, body, idempotencyKey) is persisted to
 * IndexedDB and replayed when the singleton drain worker fires — either on
 * an `online` event, on a periodic retry tick, or when a consumer mounts the
 * `useOutboxStatus()` hook.
 *
 * The replay POST sends a freshly-computed `csrfHeaders()` (not the one
 * captured at enqueue time — that token may have rotated) and the original
 * `X-Idempotency-Key`, so the server returns the cached response if the
 * original commit landed before the network died.
 *
 * Backoff: 400ms → 1s → 5s → 30s → 5min, capped. Network/5xx retain the
 * item; 4xx (other than 401/408/429) drop it because the request is bad.
 * 401 parks the queue and emits `outbox:auth-needed` — the client UI
 * surfaces a "sign in to sync N pending changes" affordance instead of
 * spinning a 401-loop.
 *
 * Quick-log keeps its own purpose-built `quick-log-queue.ts` — that path is
 * already shipped, has Background Sync API integration, and isn't worth
 * forcing into this envelope shape.
 */

const STORE = "outbox";
const BACKOFF_SCHEDULE_MS = [400, 1_000, 5_000, 30_000, 300_000];
const PERIODIC_RETRY_MS = 30_000;

export const OUTBOX_AUTH_NEEDED_EVENT = "outbox:auth-needed";

export interface EnqueueMutationInput {
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  bodyJson: unknown;
  idempotencyKey: string;
  /** Free-form metadata for client display (e.g. "Wellness check-in"). */
  metadata?: Record<string, unknown>;
}

interface OutboxEnvelope {
  id: string;
  url: string;
  method: string;
  bodyJson: unknown;
  idempotencyKey: string;
  metadata: Record<string, unknown> | undefined;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
}

let isDraining = false;
let isParked = false;
let lastSyncAt: Date | null = null;

/** Enqueue a mutation for later replay. Resolves once persisted to IDB. */
export async function enqueueMutation(input: EnqueueMutationInput): Promise<void> {
  const envelope: OutboxEnvelope = {
    id: crypto.randomUUID(),
    url: input.url,
    method: input.method,
    bodyJson: input.bodyJson,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata,
    attempts: 0,
    nextAttemptAt: Date.now(),
    createdAt: Date.now(),
  };

  try {
    const db = await openDB();
    await idbPut(db, STORE, envelope);
    db.close();
  } catch (err) {
    logger.warn("outbox: enqueue failed", {
      context: "src/lib/outbox.ts",
      metadata: { url: input.url, err: errMsg(err) },
    });
    throw err;
  }

  // Drain is driven by `useOutboxStatus()` (online event + periodic ticker).
  // Don't auto-drain here — at enqueue time the user is presumably offline
  // (the original POST just failed); a synchronous drain would race the
  // hook's drive loop with no benefit.
}

/**
 * Drain the outbox. Idempotent — if a drain is already in progress, the
 * second caller is a no-op. Called from the auto-replay effect, the periodic
 * retry tick, and explicit consumer triggers.
 */
export async function drainOutbox(): Promise<void> {
  if (isDraining || isParked) return;
  isDraining = true;

  try {
    const all = await loadAll();
    const now = Date.now();
    const due = all
      .filter((e) => e.nextAttemptAt <= now)
      .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);

    for (const item of due) {
      const result = await replayOne(item);
      if (result === "park") {
        isParked = true;
        try {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(OUTBOX_AUTH_NEEDED_EVENT));
          }
        } catch (dispatchErr) {
          // Best-effort: window/CustomEvent unavailable in some test envs.
          // The queue is still parked; consumers polling pending count will
          // notice the stuck items even without the event.
          logger.debug("outbox: auth-needed event dispatch failed", {
            context: "src/lib/outbox.ts",
            metadata: { err: errMsg(dispatchErr) },
          });
        }
        break;
      }
    }

    if (!isParked) {
      lastSyncAt = new Date();
    }
  } finally {
    isDraining = false;
  }
}

/** Number of items currently queued (regardless of nextAttemptAt). */
export async function getOutboxPending(): Promise<number> {
  try {
    const db = await openDB();
    const count = await idbCount(db, STORE);
    db.close();
    return count;
  } catch {
    return 0;
  }
}

/** Last successful drain timestamp (in-memory; resets on page load). */
export function getOutboxLastSyncAt(): Date | null {
  return lastSyncAt;
}

/**
 * React hook returning live `{ pending, lastSyncAt, isOnline }` for status
 * chips. Auto-drains when (a) the browser comes online or (b) on an interval
 * while online + items are pending. Mounting the hook anywhere in the tree
 * is enough — the drain singleton dedupes.
 */
export interface OutboxStatus {
  pending: number;
  lastSyncAt: Date | null;
  isOnline: boolean;
  authNeeded: boolean;
}

export function useOutboxStatus(): OutboxStatus {
  const { isOnline } = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [snapshot, setSnapshot] = useState<{ lastSyncAt: Date | null }>({ lastSyncAt: null });
  const [authNeeded, setAuthNeeded] = useState(false);

  // Live count — refresh on storage change, on online flip, and on a tick.
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const c = await getOutboxPending();
      if (mounted) {
        setPending(c);
        setSnapshot({ lastSyncAt: getOutboxLastSyncAt() });
      }
    };
    void refresh();
    const id = setInterval(refresh, 5_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Auto-drain when we come online (or are online with items pending).
  useEffect(() => {
    if (!isOnline) return;
    void drainOutbox();
    const id = setInterval(() => {
      void drainOutbox();
    }, PERIODIC_RETRY_MS);
    return () => clearInterval(id);
  }, [isOnline]);

  // Auth-needed event listener.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setAuthNeeded(true);
    window.addEventListener(OUTBOX_AUTH_NEEDED_EVENT, handler);
    return () => window.removeEventListener(OUTBOX_AUTH_NEEDED_EVENT, handler);
  }, []);

  return { pending, lastSyncAt: snapshot.lastSyncAt, isOnline, authNeeded };
}

// ── Internals ────────────────────────────────────────────────────────────────

async function loadAll(): Promise<OutboxEnvelope[]> {
  const db = await openDB();
  const all = await idbGetAll<OutboxEnvelope>(db, STORE);
  db.close();
  return all;
}

async function replayOne(item: OutboxEnvelope): Promise<"ok" | "retry" | "drop" | "park"> {
  let response: Response | null = null;
  let networkError: unknown = null;

  try {
    response = await fetch(item.url, {
      method: item.method,
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": item.idempotencyKey,
        ...csrfHeaders(),
      },
      body: JSON.stringify(item.bodyJson),
    });
  } catch (err) {
    networkError = err;
  }

  if (!response) {
    // Network failure — schedule a retry with backoff.
    await scheduleRetry(item, errMsg(networkError));
    return "retry";
  }

  if (response.status >= 200 && response.status < 300) {
    await removeItem(item.id);
    return "ok";
  }

  // 401: park the queue. Don't drop the item — the user can re-auth and we
  // want to drain after.
  if (response.status === 401) {
    return "park";
  }

  // Transient: 408 (request timeout), 429 (rate limited), 5xx.
  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    await scheduleRetry(item, `HTTP ${response.status}`);
    return "retry";
  }

  // Permanent client error: 400, 403, 404, 410, 422 (idempotency-key reused
  // with different body), etc. Drop — retrying won't help.
  await removeItem(item.id);
  logger.warn("outbox: dropped item on permanent client error", {
    context: "src/lib/outbox.ts",
    metadata: {
      url: item.url,
      status: response.status,
      attempts: item.attempts + 1,
      idempotencyKey: item.idempotencyKey,
    },
  });
  return "drop";
}

async function scheduleRetry(item: OutboxEnvelope, reason: string): Promise<void> {
  const next = { ...item, attempts: item.attempts + 1 };
  const delayIdx = Math.min(next.attempts - 1, BACKOFF_SCHEDULE_MS.length - 1);
  next.nextAttemptAt = Date.now() + BACKOFF_SCHEDULE_MS[delayIdx];

  try {
    const db = await openDB();
    await idbPut(db, STORE, next);
    db.close();
  } catch (err) {
    logger.warn("outbox: failed to schedule retry", {
      context: "src/lib/outbox.ts",
      metadata: { id: item.id, err: errMsg(err) },
    });
  }

  logger.debug("outbox: scheduled retry", {
    context: "src/lib/outbox.ts",
    metadata: {
      id: item.id,
      attempts: next.attempts,
      delayMs: BACKOFF_SCHEDULE_MS[delayIdx],
      reason,
    },
  });
}

async function removeItem(id: string): Promise<void> {
  try {
    const db = await openDB();
    await idbDelete(db, STORE, id);
    db.close();
  } catch (err) {
    logger.warn("outbox: failed to remove item", {
      context: "src/lib/outbox.ts",
      metadata: { id, err: errMsg(err) },
    });
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Test-only ────────────────────────────────────────────────────────────────

/** @internal — resets module-level singleton state between tests. */
export function __resetOutboxForTest(): void {
  isDraining = false;
  isParked = false;
  lastSyncAt = null;
}
