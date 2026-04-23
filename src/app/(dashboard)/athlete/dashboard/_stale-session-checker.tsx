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

        const data = (await res.json()) as {
          staleSession: { id: string } | null;
        };
        if (cancelled || !data.staleSession) return;

        // Mark the session complete before redirecting. If the complete call
        // fails we stay put — redirecting to the recap with an IN_PROGRESS
        // session would render the wrong view and confuse the athlete.
        const completeRes = await fetch(`/api/athlete/sessions/${data.staleSession.id}/complete`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({}),
        }).catch((err) => {
          console.warn("stale session complete failed", err);
          return null;
        });
        if (cancelled || !completeRes?.ok) return;

        router.push(`/athlete/session/${data.staleSession.id}?view=recap`);
      } catch (err) {
        // Non-fatal — feature is optional, but still log for diagnostics.
        console.warn("stale session check failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
