"use client";

/**
 * Unread-count hook — fetches /api/throws/comments/unread-count and exposes
 * helpers for badge rendering and cache invalidation. No SWR dep — this is
 * a tiny focused hook with revalidate-on-focus built in.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type TargetField =
  | "throwLogId"
  | "practiceAttemptId"
  | "trainingSessionId"
  | "throwsAssignmentId"
  | "athleteDrillLogId"
  | "videoAnalysisId";

type UnreadMap = Record<TargetField, Record<string, number>>;

type State = {
  total: number;
  byTarget: UnreadMap;
  loading: boolean;
  lastFetched: number;
};

const EMPTY_BY_TARGET: UnreadMap = {
  throwLogId: {},
  practiceAttemptId: {},
  trainingSessionId: {},
  throwsAssignmentId: {},
  athleteDrillLogId: {},
  videoAnalysisId: {},
};

/** Module-level store so all consumers share one cache. */
let state: State = {
  total: 0,
  byTarget: EMPTY_BY_TARGET,
  loading: false,
  lastFetched: 0,
};

const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;
const STALE_MS = 60_000;

function notify() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): State {
  return state;
}

function getServerSnapshot(): State {
  return state;
}

async function fetchNow(): Promise<void> {
  if (inFlight) return inFlight;
  state = { ...state, loading: true };
  notify();
  inFlight = (async () => {
    try {
      const res = await fetch("/api/throws/comments/unread-count", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`unread-count ${res.status}`);
      const payload = await res.json();
      if (payload?.success && payload.data) {
        state = {
          total: Number(payload.data.total) || 0,
          byTarget: { ...EMPTY_BY_TARGET, ...(payload.data.byTarget as UnreadMap) },
          loading: false,
          lastFetched: Date.now(),
        };
      } else {
        state = { ...state, loading: false };
      }
    } catch {
      state = { ...state, loading: false };
    } finally {
      inFlight = null;
      notify();
    }
  })();
  return inFlight;
}

/**
 * Clears the count for a specific (targetField, targetId) immediately —
 * called from the consumer after a successful mark-thread-read so badges
 * disappear without waiting for the next refetch.
 */
function optimisticClear(field: TargetField, id: string) {
  const current = state.byTarget[field][id];
  if (!current) return;
  const nextField = { ...state.byTarget[field] };
  delete nextField[id];
  state = {
    ...state,
    total: Math.max(0, state.total - current),
    byTarget: { ...state.byTarget, [field]: nextField },
  };
  notify();
}

/** Revalidate-on-focus — wired once at module load on the client. */
if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    if (Date.now() - state.lastFetched > STALE_MS) void fetchNow();
  });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - state.lastFetched > STALE_MS) {
      void fetchNow();
    }
  });
}

/** Top-level hook — subscribes to the shared store. */
export function useCommentUnread() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!snap.lastFetched) void fetchNow();
  }, [snap.lastFetched]);

  const refresh = useCallback(() => fetchNow(), []);
  const clear = useCallback((field: TargetField, id: string) => optimisticClear(field, id), []);

  return {
    total: snap.total,
    byTarget: snap.byTarget,
    loading: snap.loading,
    refresh,
    clear,
  };
}

/** Quick accessor for a single target — avoids re-rendering on unrelated changes. */
export function useUnreadFor(field: TargetField, id: string | null | undefined): number {
  const { byTarget } = useCommentUnread();
  if (!id) return 0;
  return byTarget[field][id] ?? 0;
}
