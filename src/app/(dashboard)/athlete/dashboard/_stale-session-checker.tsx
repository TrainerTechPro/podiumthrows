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

        // Mark the session complete (best effort). If this fails, the session
        // stays open and the athlete can complete it manually.
        await fetch(`/api/athlete/sessions/${data.staleSession.id}/complete`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...csrfHeaders() },
          body: JSON.stringify({}),
        }).catch(() => null);

        if (cancelled) return;
        router.push(`/athlete/sessions/${data.staleSession.id}/recap`);
      } catch {
        // Silent fail — feature is optional
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
