"use client";

/**
 * Centralized cleanup of per-user client state. Call on logout *and* on
 * fresh login / register success so a shared device never leaks state
 * across accounts.
 *
 * Two classes of leakage this prevents:
 *
 * 1) **Data integrity** — IndexedDB queues (`quick-log-queue`, `sync-queue`,
 *    `outbox`) replay pending mutations against whoever is currently signed
 *    in. Without cleanup, user A's offline throws would be POSTed under
 *    user B's session cookie and silently attributed to user B's profile.
 *
 * 2) **Privacy / UI** — localStorage holds recent search queries, customized
 *    quick-action layouts, unit preferences, and dedup keys (timezone send,
 *    streak reminder fire). Without cleanup, user B sees these on first
 *    paint until the server-rendered value overrides — and dedup keys can
 *    block user B's first PATCH from firing at all.
 *
 * Trade-off: pending offline mutations in the IDB queues that haven't
 * replayed yet are *discarded* by this cleanup. That's deliberate. Replaying
 * them under a different identity is the worse failure mode — a coach
 * picking up an athlete's phone could silently overwrite the athlete's
 * training log. Losing pending data is recoverable (the user re-enters);
 * mis-attributed data is not.
 */

import { openDB, idbGetAll, idbDelete } from "@/lib/pwa/idb";
import { clearAllUserDrafts } from "@/lib/draft-persistence";
import { resetCommentUnreadStore } from "@/lib/hooks/useCommentUnread";
import { logger } from "@/lib/logger";

/** localStorage keys that hold per-user (not per-device) state. */
const PER_USER_LOCAL_KEYS: readonly string[] = [
  "podium-tz-sent",
  "podium-search-recent",
  "podium-display-units",
  "podium-quick-actions-coach",
  "podium-quick-actions-athlete",
  "streak-reminder-last-fired",
];

/** localStorage key prefixes that hold per-user state with a variable suffix. */
const PER_USER_LOCAL_PREFIXES: readonly string[] = [
  "podium:questionnaire:useprev:",
  "podium:plate:", // PlateCalculator persists per athlete+exercise
  "podium:integrations-reauth-dismissed:",
];

/** IDB stores that are wholly per-user — drop everything on identity change. */
const PER_USER_IDB_STORES: readonly string[] = ["quick-log-queue", "sync-queue", "outbox"];

function clearLocalKeys(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of PER_USER_LOCAL_KEYS) {
      window.localStorage.removeItem(key);
    }
    // Sweep prefixed keys.
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && PER_USER_LOCAL_PREFIXES.some((p) => k.startsWith(p))) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) {
      window.localStorage.removeItem(k);
    }
  } catch (err) {
    // ok: localStorage may throw under Safari private mode or storage
    // quotas. We've already cleared what we could; next mount renders
    // fresh state regardless.
    logger.debug("client-state-cleanup: localStorage clear partial", {
      context: "lib/client-state-cleanup",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
}

async function clearIdbStore(db: IDBDatabase, storeName: string): Promise<number> {
  if (!db.objectStoreNames.contains(storeName)) return 0;
  try {
    const rows = await idbGetAll<{ id?: string; clientId?: string }>(db, storeName);
    let removed = 0;
    for (const row of rows) {
      const key = row.id ?? row.clientId;
      if (!key) continue;
      await idbDelete(db, storeName, key);
      removed++;
    }
    return removed;
  } catch (err) {
    logger.warn("client-state-cleanup: idb store clear failed", {
      context: "lib/client-state-cleanup",
      metadata: { storeName, reason: err instanceof Error ? err.message : "unknown" },
    });
    return 0;
  }
}

async function clearAllUserIdbQueues(): Promise<void> {
  try {
    const db = await openDB();
    for (const storeName of PER_USER_IDB_STORES) {
      await clearIdbStore(db, storeName);
    }
    db.close();
  } catch (err) {
    logger.warn("client-state-cleanup: idb open failed", {
      context: "lib/client-state-cleanup",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
}

/**
 * Clear every per-user client artifact. Pass the user ID being signed out
 * (or the one about to be signed in, for a defensive pre-login wipe).
 *
 * Safe to call multiple times; non-fatal on individual failures.
 */
export async function clearAllClientStateForUser(userId: string): Promise<void> {
  // Drafts cleanup is userId-scoped (only this user's drafts are removed).
  // Queue cleanup is total (we can't be sure which rows belong to whom for
  // pre-migration data, and the worst case is a re-enter).
  await Promise.all([clearAllUserDrafts(userId), clearAllUserIdbQueues()]);
  clearLocalKeys();
  // In-memory module stores: client-side navigation (router.push) doesn't
  // tear down JS state, so we explicitly flush the caches that hold the
  // signed-in user's data.
  resetCommentUnreadStore();
}
