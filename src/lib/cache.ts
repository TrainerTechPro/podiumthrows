import { unstable_cache } from "next/cache";

// ---------------------------------------------------------------------------
// Cached data-fetching wrappers
//
// Each wrapper delegates to the real data function but adds:
//   - Time-based revalidation (TTL)
//   - Tag-based on-demand invalidation via revalidateTag()
//
// Usage:  import { cachedGetCoachStats } from "@/lib/cache";
//         const stats = await cachedGetCoachStats(coachId);
//
// Invalidation: call revalidateTag(`coach-${coachId}`) in mutation routes.
// ---------------------------------------------------------------------------

import {
  getCoachStats,
  getAthleteRoster,
  getExerciseLibrary,
  getRecentActivity,
  getFlaggedAthletes,
  getTeamThrowSummary,
} from "@/lib/data/coach";

import {
  fetchReadinessData,
  fetchQuickStatsData,
  fetchPRsData,
} from "@/lib/data/dashboard";

import {
  getAthleteStats,
  getAthleteSessionHistory,
} from "@/lib/data/athlete";

// ── Coach queries ─────────────────────────────────────────────────────

export const cachedGetCoachStats = (coachId: string) =>
  unstable_cache(
    () => getCoachStats(coachId),
    [`coach-stats-${coachId}`],
    { revalidate: 300, tags: [`coach-${coachId}`] },
  )();

export const cachedGetAthleteRoster = (coachId: string) =>
  unstable_cache(
    () => getAthleteRoster(coachId),
    [`roster-${coachId}`],
    { revalidate: 300, tags: [`coach-${coachId}`] },
  )();

export const cachedGetExerciseLibrary = (coachId: string) =>
  unstable_cache(
    () => getExerciseLibrary(coachId),
    [`exercises-${coachId}`],
    { revalidate: 3600, tags: [`exercises`, `coach-${coachId}`] },
  )();

export const cachedGetRecentActivity = (
  coachId: string,
  limit?: number,
  notableOnly?: boolean,
) =>
  unstable_cache(
    () => getRecentActivity(coachId, limit, notableOnly),
    [`activity-${coachId}-${limit ?? "all"}-${notableOnly ?? false}`],
    { revalidate: 120, tags: [`coach-${coachId}`] },
  )();

export const cachedGetFlaggedAthletes = (coachId: string) =>
  unstable_cache(
    () => getFlaggedAthletes(coachId),
    [`flagged-${coachId}`],
    { revalidate: 300, tags: [`coach-${coachId}`] },
  )();

export const cachedGetTeamThrowSummary = (coachId: string) =>
  unstable_cache(
    () => getTeamThrowSummary(coachId),
    [`team-throws-${coachId}`],
    { revalidate: 600, tags: [`coach-${coachId}`] },
  )();

// ── Athlete queries ───────────────────────────────────────────────────

export const cachedFetchReadinessData = (athleteId: string) =>
  unstable_cache(
    () => fetchReadinessData(athleteId),
    [`readiness-${athleteId}`],
    { revalidate: 300, tags: [`athlete-${athleteId}`] },
  )();

export const cachedFetchQuickStatsData = (athleteId: string) =>
  unstable_cache(
    () => fetchQuickStatsData(athleteId),
    [`quick-stats-${athleteId}`],
    { revalidate: 300, tags: [`athlete-${athleteId}`] },
  )();

export const cachedFetchPRsData = (athleteId: string) =>
  unstable_cache(
    () => fetchPRsData(athleteId),
    [`prs-${athleteId}`],
    { revalidate: 600, tags: [`athlete-${athleteId}`] },
  )();

export const cachedGetAthleteStats = (athleteId: string) =>
  unstable_cache(
    () => getAthleteStats(athleteId),
    [`athlete-stats-${athleteId}`],
    { revalidate: 300, tags: [`athlete-${athleteId}`] },
  )();

export const cachedGetAthleteSessionHistory = (
  athleteId: string,
  limit?: number,
) =>
  unstable_cache(
    () => getAthleteSessionHistory(athleteId, limit),
    [`session-history-${athleteId}-${limit ?? "all"}`],
    { revalidate: 600, tags: [`athlete-${athleteId}`] },
  )();
