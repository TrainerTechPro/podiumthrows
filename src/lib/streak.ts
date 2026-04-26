/**
 * Throws-based streak shim.
 *
 * Pre-engine, this file owned a recompute-from-history streak algorithm. The
 * canonical streak logic now lives in `src/lib/athlete/streak-engine.ts` —
 * this module is a thin wrapper that preserves the legacy `updateThrowsStreak`
 * signature so existing callers (throws quick-log, readiness check-ins,
 * legacy session completion paths) keep working without churn.
 *
 * New code should call `extendStreakForActivity` directly from the engine.
 */

import { extendStreakForActivity } from "@/lib/athlete/streak-engine";

/**
 * Legacy contract: returns the new currentStreak on success, or null on
 * failure / no-op. Used by routes that surface the new value to the client.
 */
export async function updateThrowsStreak(athleteId: string): Promise<number | null> {
  const result = await extendStreakForActivity(athleteId);
  return result?.currentStreak ?? null;
}
