"use client";

import { useEffect, useRef } from "react";

/**
 * Invisible component that triggers a background Oura Ring sync on mount.
 * Only rendered when the athlete has an Oura connection with stale data.
 * Fires once per mount (page open), never blocks rendering.
 */
export function OuraAutoSync() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    fetch("/api/oura/sync", { method: "POST" }).catch(() => {
      // Silently ignore — sync failures are logged server-side
    });
  }, []);

  return null;
}
