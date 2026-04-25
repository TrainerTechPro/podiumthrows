"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { openDB, idbGet, idbPut, idbDelete, idbGetAll } from "@/lib/pwa/idb";
import { logger } from "@/lib/logger";

/**
 * Form-draft persistence over the existing podium-pwa IndexedDB (v3 store
 * `form-drafts`). Each draft is keyed `${userId}:${formKey}:${entityId?}` so
 * a single user can have multiple in-flight drafts and different users on
 * the same device cannot read each other's data.
 *
 * Writes are debounced 400ms — typing through a long form costs one IDB
 * write at the trailing edge, not one per keystroke.
 *
 * On mount, the hook reads the existing draft and seeds the form state with
 * it (if younger than 7 days). Older entries are ignored (and removed by
 * `clearAllStaleDrafts()` on app start). The 7-day window is the gate
 * against showing a "resume" toast for a session the athlete has long
 * abandoned.
 *
 * `clearAllUserDrafts(userId)` runs on logout — IndexedDB persists across
 * sessions on the same device, so without it a coach demoing on an
 * athlete's phone would leak prior drafts.
 */

const STORE = "form-drafts";
const DEBOUNCE_MS = 400;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_DRAFT_BYTES = 500_000;

interface DraftEnvelope<T> {
  key: string;
  userId: string;
  data: T;
  timestamp: number;
}

export interface DraftStatus {
  /** True if a non-stale draft was loaded at mount. */
  hasDraft: boolean;
  /** Timestamp of the last persisted write (or the loaded draft on mount). */
  lastSavedAt: Date | null;
  /** Manually clear the draft from IDB and reset hook state flags. */
  clearDraft: () => Promise<void>;
}

/**
 * Stateful form-draft persistence hook.
 *
 * Pass `null` as the key to disable the hook (e.g. while userId is loading).
 * The form state will fall back to `initial` and no IDB I/O occurs.
 */
export function useDraftPersistence<T>(
  key: string | null,
  initial: T
): [T, (next: T | ((prev: T) => T)) => void, DraftStatus] {
  const [value, setValueState] = useState<T>(initial);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const keyRef = useRef(key);
  keyRef.current = key;

  // Mount: read existing draft.
  useEffect(() => {
    if (!key) {
      mountedRef.current = true;
      return;
    }
    let cancelled = false;

    void (async () => {
      const data = await readDraft<T>(key);
      if (cancelled) return;
      if (data !== null) {
        setValueState(data.value);
        setHasDraft(true);
        setLastSavedAt(new Date(data.timestamp));
      }
      mountedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  // Setter: update state + debounced IDB write.
  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setValueState((prev) => {
      const nextValue = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      const currentKey = keyRef.current;

      if (currentKey && mountedRef.current) {
        if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
        writeTimerRef.current = setTimeout(() => {
          void persistDraft(currentKey, nextValue).then((wrote) => {
            if (wrote) setLastSavedAt(new Date());
          });
        }, DEBOUNCE_MS);
      }

      return nextValue;
    });
  }, []);

  // Cancel any pending write on unmount so we don't persist after the form
  // has been intentionally torn down.
  useEffect(() => {
    return () => {
      if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    };
  }, []);

  const clearDraft = useCallback(async () => {
    if (!key) return;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    try {
      const db = await openDB();
      await idbDelete(db, STORE, key);
      db.close();
    } catch (err) {
      logger.warn("draft-persistence: clear failed", {
        context: "src/lib/draft-persistence.ts",
        metadata: { key, err: errMsg(err) },
      });
    }
    setHasDraft(false);
    setLastSavedAt(null);
  }, [key]);

  return [value, setValue, { hasDraft, lastSavedAt, clearDraft }];
}

/**
 * Removes drafts older than the staleness window. Call once at app mount,
 * and again whenever an outbox drain completes successfully.
 */
export async function clearAllStaleDrafts(): Promise<number> {
  const cutoff = Date.now() - STALE_AFTER_MS;
  try {
    const db = await openDB();
    const all = await idbGetAll<DraftEnvelope<unknown>>(db, STORE);
    let removed = 0;
    for (const env of all) {
      if (env.timestamp < cutoff) {
        await idbDelete(db, STORE, env.key);
        removed++;
      }
    }
    db.close();
    return removed;
  } catch (err) {
    logger.warn("draft-persistence: stale cleanup failed", {
      context: "src/lib/draft-persistence.ts",
      metadata: { err: errMsg(err) },
    });
    return 0;
  }
}

/**
 * Removes every draft owned by the given userId. Call from the logout flow
 * so a shared device never leaks prior-user drafts to the next sign-in.
 */
export async function clearAllUserDrafts(userId: string): Promise<number> {
  try {
    const db = await openDB();
    const all = await idbGetAll<DraftEnvelope<unknown>>(db, STORE);
    let removed = 0;
    for (const env of all) {
      if (env.userId === userId) {
        await idbDelete(db, STORE, env.key);
        removed++;
      }
    }
    db.close();
    return removed;
  } catch (err) {
    logger.warn("draft-persistence: user cleanup failed", {
      context: "src/lib/draft-persistence.ts",
      metadata: { userId, err: errMsg(err) },
    });
    return 0;
  }
}

// ── Internals ────────────────────────────────────────────────────────────────

async function persistDraft<T>(key: string, data: T): Promise<boolean> {
  const userId = key.split(":", 1)[0];
  if (!userId) return false;
  const envelope: DraftEnvelope<T> = { key, userId, data, timestamp: Date.now() };

  // Cap individual drafts. A bloated draft (paste of an entire document)
  // would silently push other entries out via quota — better to log and
  // skip than to corrupt the store.
  let serializedLength: number;
  try {
    serializedLength = JSON.stringify(envelope).length;
  } catch (err) {
    logger.warn("draft-persistence: failed to serialize draft", {
      context: "src/lib/draft-persistence.ts",
      metadata: { key, err: errMsg(err) },
    });
    return false;
  }
  if (serializedLength > MAX_DRAFT_BYTES) {
    logger.warn("draft-persistence: draft exceeds size cap, skipping", {
      context: "src/lib/draft-persistence.ts",
      metadata: { key, bytes: serializedLength, cap: MAX_DRAFT_BYTES },
    });
    return false;
  }

  try {
    const db = await openDB();
    await idbPut(db, STORE, envelope);
    db.close();
    return true;
  } catch (err) {
    logger.warn("draft-persistence: write failed", {
      context: "src/lib/draft-persistence.ts",
      metadata: { key, err: errMsg(err) },
    });
    return false;
  }
}

async function readDraft<T>(key: string): Promise<{ value: T; timestamp: number } | null> {
  const userId = key.split(":", 1)[0];
  if (!userId) return null;
  try {
    const db = await openDB();
    const envelope = await idbGet<DraftEnvelope<T>>(db, STORE, key);
    db.close();
    if (!envelope) return null;
    if (envelope.userId !== userId) return null;
    if (Date.now() - envelope.timestamp >= STALE_AFTER_MS) return null;
    return { value: envelope.data, timestamp: envelope.timestamp };
  } catch (err) {
    logger.warn("draft-persistence: read failed", {
      context: "src/lib/draft-persistence.ts",
      metadata: { key, err: errMsg(err) },
    });
    return null;
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Test exports — not part of the public API ────────────────────────────────

/** @internal — exported for unit tests only. Do not use from product code. */
export const persistDraftForTest = persistDraft;

/** @internal — exported for unit tests only. Returns just the data on hit. */
export async function readDraftForTest<T>(key: string): Promise<T | null> {
  const result = await readDraft<T>(key);
  return result ? result.value : null;
}
