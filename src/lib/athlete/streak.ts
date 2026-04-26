/**
 * Session-completion streak shim.
 *
 * Pre-engine, this file owned an increment-based streak update path tailored
 * to session completions across the three source tables. The canonical streak
 * logic now lives in `src/lib/athlete/streak-engine.ts` — this module is a
 * thin wrapper that preserves the legacy `updateStreakForCompletion` signature
 * so existing callers (`on-session-complete.ts` and friends) keep working
 * without churn.
 *
 * New code should call `extendStreakForActivity` directly from the engine.
 */

import { extendStreakForActivity } from "@/lib/athlete/streak-engine";

export async function updateStreakForCompletion(
  athleteId: string,
  completedAt: Date
): Promise<void> {
  await extendStreakForActivity(athleteId, completedAt);
}
