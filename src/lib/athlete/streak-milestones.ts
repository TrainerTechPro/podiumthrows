/**
 * Pure milestone constants for athlete streaks. Lives in its own file so
 * client components (e.g. _streak-celebration.tsx) can import the values
 * without dragging the server-only streak-engine chain (web-push → Node `net`)
 * into the client bundle. The full engine in streak-engine.ts re-exports
 * these so server-side callers keep their existing import path.
 */

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];
