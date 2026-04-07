"use client";

import { useEffect } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

/**
 * On mount, detect the user's browser timezone and PATCH it to the server if
 * it's different from the last-sent value. Uses localStorage to dedupe so we
 * don't PATCH on every page load.
 */
export function useDetectTimezone() {
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!detected) return;

      const lastSent =
        typeof window !== "undefined" ? localStorage.getItem("podium-tz-sent") : null;
      if (lastSent === detected) return;

      void fetch("/api/user/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ timezone: detected }),
      })
        .then((res) => {
          if (res.ok) {
            try {
              localStorage.setItem("podium-tz-sent", detected);
            } catch {
              // ignore storage failures
            }
          }
        })
        .catch(() => {
          // silent — will retry on next page load
        });
    } catch {
      // Intl unsupported — skip
    }
  }, []);
}
