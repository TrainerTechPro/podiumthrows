"use client";

/**
 * Stale Session Checker
 *
 * Fires once on dashboard mount. Calls /api/athlete/sessions/check-stale to see
 * whether any in-progress session has been idle for >90 minutes. If so, we
 * mark that session complete via the existing PATCH endpoint and then
 * redirect the athlete to its recap page. Silent on failure — this is a
 * nice-to-have, not load-bearing.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

import { logger } from "@/lib/logger";
export function StaleSessionChecker() {
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/athlete/sessions/check-stale", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
        });
        if (!res.ok || cancelled) return;

        const payload = (await res.json()) as
          | { success: true; data: { staleSession: { id: string } | null } }
          | { success: false; error: string };
        if (cancelled || !payload.success || !payload.data.staleSession) return;
        const staleSession = payload.data.staleSession;

        // Mark the session complete before redirecting. If the complete call
        // fails we stay put — redirecting to the recap with an IN_PROGRESS
        // session would render the wrong view and confuse the athlete.
        const completeRes = await fetch(`/api/athlete/sessions/${staleSession.id}/complete`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({}),
        }).catch((err) => {
          logger.warn("stale session complete failed", {
            context: "athlete/dashboard/stale-session-checker",
            error: err,
          });
          return null;
        });
        if (cancelled || !completeRes?.ok) return;

        router.push(`/athlete/session/${staleSession.id}?view=recap`);
      } catch (err) {
        // Non-fatal — feature is optional, but still log for diagnostics.
        logger.warn("stale session check failed", {
          context: "athlete/dashboard/stale-session-checker",
          error: err,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
