"use client";

import { useEffect } from "react";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";

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
            } catch (err) {
              // ignore storage failures
              logger.debug("ignore storage failures", {
                context: "src/hooks/useDetectTimezone.ts",
                metadata: { reason: err instanceof Error ? err.message : "unknown" },
              });
            }
          }
        })
        .catch(() => {
          // silent — will retry on next page load
        });
    } catch (err) {
      // Intl unsupported — skip
      logger.debug("Intl unsupported — skip", {
        context: "src/hooks/useDetectTimezone.ts",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
  }, []);
}
