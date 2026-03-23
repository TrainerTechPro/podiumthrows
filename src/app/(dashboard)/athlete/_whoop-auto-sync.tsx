"use client";

import { useEffect, useRef } from "react";

/**
 * Invisible component that triggers a background WHOOP sync on mount.
 * Only rendered when the athlete has a WHOOP connection with stale data.
 * Fires once per mount (page open), never blocks rendering.
 */
export function WhoopAutoSync() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    fetch("/api/whoop/sync", { method: "POST" }).catch(() => {
      // Silently ignore — sync failures are logged server-side
    });
  }, []);

  return null;
}
