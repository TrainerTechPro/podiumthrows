"use client";

import { useEffect, useRef } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // Re-sync every 30 minutes while app is open

/**
 * Invisible component that triggers a background Oura Ring sync on mount,
 * then re-syncs every 30 minutes while the tab is open.
 * Only rendered when the athlete has an Oura connection with stale data.
 */
export function OuraAutoSync() {
  const fired = useRef(false);

  useEffect(() => {
    function doSync() {
      fetch("/api/oura/sync", {
        method: "POST",
        headers: csrfHeaders(),
      }).catch(() => {
        // Silently ignore — sync failures are logged server-side
      });
    }

    // Fire immediately on first mount
    if (!fired.current) {
      fired.current = true;
      doSync();
    }

    // Re-sync periodically while the tab is open
    const interval = setInterval(doSync, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
}
