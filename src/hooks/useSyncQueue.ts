"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "@/lib/pwa/online-status";
import {
  queueAttempt as queueAttemptIDB,
  replayQueue,
  getPendingCount,
  type AttemptPayload,
  type QueuedAttempt,
  type SyncResult,
} from "@/lib/pwa/sync-queue";

interface UseSyncQueueReturn {
  pendingCount: number;
  isSyncing: boolean;
  queueAttempt: (
    sessionId: string,
    payload: AttemptPayload
  ) => Promise<QueuedAttempt>;
  triggerSync: () => Promise<SyncResult[]>;
}

/**
 * React hook for offline throw attempt sync queue.
 * Auto-replays pending items when connectivity resumes.
 */
export function useSyncQueue(
  onSyncComplete?: (results: SyncResult[]) => void
): UseSyncQueueReturn {
  const { isOnline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSyncCompleteRef = useRef(onSyncComplete);
  onSyncCompleteRef.current = onSyncComplete;

  // Refresh pending count from IDB
  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IDB might not be available
    }
  }, []);

  // Queue a new attempt
  const queueAttempt = useCallback(
    async (
      sessionId: string,
      payload: AttemptPayload
    ): Promise<QueuedAttempt> => {
      const item = await queueAttemptIDB(sessionId, payload);
      setPendingCount((c) => c + 1);
      return item;
    },
    []
  );

  // Replay the queue
  const triggerSync = useCallback(async (): Promise<SyncResult[]> => {
    if (isSyncing) return [];
    setIsSyncing(true);
    try {
      const results = await replayQueue();
      await refreshCount();
      if (results.length > 0) {
        onSyncCompleteRef.current?.(results);
      }
      return results;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshCount]);

  // Listen for SW sync-complete messages
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_COMPLETE") {
        refreshCount();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      // Small delay to let the network stabilize
      const timeout = setTimeout(() => {
        triggerSync();
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, pendingCount, triggerSync]);

  // Periodic retry when online but items still pending
  // (handles cases where online event fires but network is flaky)
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      retryTimerRef.current = setInterval(() => {
        triggerSync();
      }, 30000);
    } else if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
      }
    };
  }, [isOnline, pendingCount, isSyncing, triggerSync]);

  // Initial count on mount
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return { pendingCount, isSyncing, queueAttempt, triggerSync };
}
