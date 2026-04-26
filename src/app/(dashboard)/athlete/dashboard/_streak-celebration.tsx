"use client";

/**
 * Streak Milestone Celebration Gate
 *
 * On mount, compares the server-rendered `currentStreak` against a per-device
 * localStorage cursor. If the streak has crossed a milestone the device hasn't
 * celebrated yet, fires the full-screen PRCelebration overlay once and writes
 * the cursor forward.
 *
 * Why client-side cursor rather than DB:
 *   - Achievement rows already dedupe via the unique `(athleteId, badgeKey)`
 *     index — the badge is only "earned" once on the server.
 *   - Celebration is a per-device experience: an athlete who crosses on web
 *     SHOULD see it again the next time they open the iPhone (the device
 *     should pop the celebration the first time it sees the new value).
 *   - Avoids a server round-trip for what is fundamentally a UX trigger.
 *
 * The localStorage cursor stores the largest milestone already celebrated.
 * A reset (cursor === 0) means we treat the existing value as the baseline:
 * we do NOT retroactively celebrate streaks the device already had on first
 * mount — those are the "before this feature shipped" baseline.
 */

import { useEffect, useState } from "react";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { STREAK_MILESTONES } from "@/lib/athlete/streak-milestones";
import { logger } from "@/lib/logger";

const CURSOR_KEY = "pt:streak:milestoneCelebrated";

const MILESTONE_COPY: Record<number, { title: string; icon: string; sublabel: string }> = {
  3: { title: "Threshold", icon: "🌱", sublabel: "Three days. The streak takes hold." },
  7: { title: "Week Warrior", icon: "🔥", sublabel: "Seven days in a row." },
  14: { title: "Fortnight", icon: "🔥", sublabel: "Two weeks of daily presence." },
  30: { title: "Month of Mondays", icon: "⚡", sublabel: "A full month — every day." },
  60: { title: "Sixty", icon: "💎", sublabel: "Two months of consistency." },
  100: { title: "Centurion", icon: "💯", sublabel: "One hundred days. Rare air." },
  365: { title: "All Year", icon: "👑", sublabel: "An unbroken year." },
};

export function StreakCelebrationGate({ currentStreak }: { currentStreak: number }) {
  const [celebration, setCelebration] = useState<{ days: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentStreak < STREAK_MILESTONES[0]) return;

    let cursor: number | null = null;
    try {
      const raw = window.localStorage.getItem(CURSOR_KEY);
      cursor = raw === null ? null : Number.parseInt(raw, 10);
      if (cursor !== null && !Number.isFinite(cursor)) cursor = null;
    } catch {
      cursor = null;
    }

    // First mount on this device: seed the cursor at the largest milestone the
    // CURRENT streak has already passed. We don't retroactively celebrate.
    if (cursor === null) {
      const baseline = STREAK_MILESTONES.filter((m) => currentStreak >= m).pop() ?? 0;
      try {
        window.localStorage.setItem(CURSOR_KEY, String(baseline));
      } catch (err) {
        logger.debug("streak celebration: cursor seed failed", {
          context: "ui",
          metadata: { reason: err instanceof Error ? err.message : "unknown" },
        });
      }
      return;
    }

    // Find the next uncelebrated milestone we've now reached
    const newlyCrossed = STREAK_MILESTONES.find((m) => currentStreak >= m && cursor! < m);
    if (newlyCrossed === undefined) return;

    setCelebration({ days: newlyCrossed });
    try {
      // Advance to the highest milestone now reached, not just the first
      const maxReached = STREAK_MILESTONES.filter((m) => currentStreak >= m).pop() ?? newlyCrossed;
      window.localStorage.setItem(CURSOR_KEY, String(maxReached));
    } catch (err) {
      logger.debug("streak celebration: cursor advance failed", {
        context: "ui",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
  }, [currentStreak]);

  if (celebration === null) return null;
  const copy = MILESTONE_COPY[celebration.days];
  if (!copy) return null;

  return (
    <PRCelebration
      show
      onDismiss={() => setCelebration(null)}
      title={copy.title}
      subtitle={`${celebration.days}-day streak`}
      icon={copy.icon}
    />
  );
}
