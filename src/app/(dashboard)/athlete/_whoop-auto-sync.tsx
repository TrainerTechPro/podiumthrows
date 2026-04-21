"use client";

import { useEffect } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // Re-sync every 30 minutes while app is open

// Module-level gate. Survives component remounts, which React re-mounts
// on every navigation between sibling athlete routes. The old `useRef`
// fire-gate was reset on each mount, so navigating every ~2 min inside
// athlete routes meant the 30-min interval was reset every 2 min and
// the sync re-fired on every navigation. Module scope persists until
// full page unload (log-out, hard reload), which is exactly when we
// want to re-initialize.
let started = false;

function start() {
  if (started) return;
  started = true;

  const doSync = () => {
    fetch("/api/whoop/sync", {
      method: "POST",
      headers: csrfHeaders(),
    }).catch(() => {
      // Silently ignore — sync failures are logged server-side
    });
  };

  doSync();
  // Intentional: no cleanup. The interval persists across component
  // remounts within the same page session, and the browser reclaims it
  // on page unload.
  setInterval(doSync, SYNC_INTERVAL_MS);
}

/**
 * Invisible component that triggers a background WHOOP sync on first
 * render of the athlete layout, then re-syncs every 30 minutes while
 * the tab is open. Only rendered when the athlete has a WHOOP connection.
 */
export function WhoopAutoSync() {
  useEffect(() => {
    start();
  }, []);

  return null;
}
