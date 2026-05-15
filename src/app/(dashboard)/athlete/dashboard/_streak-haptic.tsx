"use client";

import { useEffect } from "react";
import { haptic } from "@/lib/haptic";
import { logger } from "@/lib/logger";

/* ─── Streak Haptic Trigger ──────────────────────────────────────────────────
   Fires haptic.streak() exactly once when the athlete's current streak
   has *extended* since the last time this component mounted on this device.

   Compares the server-rendered `streak` against a localStorage cursor.
   - First mount on device: seed the cursor, no buzz (we don't celebrate
     the existing baseline — we celebrate the change).
   - Same value: no buzz.
   - Higher value: buzz, then advance the cursor.
   - Lower value (streak broke and reset): silently advance the cursor.
   ───────────────────────────────────────────────────────────────────────── */

const KEY = "pt:streak:lastSeen";

export function StreakHaptic({ streak }: { streak: number }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let prior: number | null = null;
    try {
      const raw = window.localStorage.getItem(KEY);
      prior = raw === null ? null : Number.parseInt(raw, 10);
      if (prior !== null && !Number.isFinite(prior)) prior = null;
    } catch (err) {
      // Safari private mode / quota — fall through to no-prior behavior.
      logger.debug("streak haptic: localStorage read failed", {
        context: "ui",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
      prior = null;
    }

    if (prior !== null && streak > prior) {
      haptic.streak();
    }

    try {
      window.localStorage.setItem(KEY, String(streak));
    } catch (err) {
      // ok: best-effort cursor — Safari private mode / quota. Worst case the
      // next mount fires the haptic once more on the same value; harmless.
      logger.debug("streak haptic: localStorage write failed", {
        context: "ui",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
  }, [streak]);

  return null;
}
