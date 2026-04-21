"use client";

import { useEffect } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // Re-sync every 30 minutes while app is open

// Module-level gate. See _whoop-auto-sync.tsx for the full rationale —
// TL;DR: useRef resets on remount, which happens on every navigation
// between sibling athlete routes. Module scope persists until full page
// unload.
let started = false;

function start() {
  if (started) return;
  started = true;

  const doSync = () => {
    fetch("/api/oura/sync", {
      method: "POST",
      headers: csrfHeaders(),
    }).catch(() => {
      // Silently ignore — sync failures are logged server-side
    });
  };

  doSync();
  setInterval(doSync, SYNC_INTERVAL_MS);
}

/**
 * Invisible component that triggers a background Oura Ring sync on first
 * render of the athlete layout, then re-syncs every 30 minutes while the
 * tab is open. Only rendered when the athlete has an Oura connection.
 */
export function OuraAutoSync() {
  useEffect(() => {
    start();
  }, []);

  return null;
}
