import prisma from "@/lib/prisma";

/**
 * Team leaderboard + streak standings.
 *
 * Both functions take a `viewerRole` so privacy enforcement can be turned
 * off for coach callers — coaches see every PR/streak regardless of an
 * athlete's `feedPrivacy.sharePRs`/`shareStreaks` opt-out, since the
 * coaching relationship overrides peer-visibility settings.
 */

export type LeaderboardEntry = {
  rank: number;
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  event: string;
  implement: string;
  distance: number;
  achievedAt: string; // YYYY-MM-DD
  isViewer: boolean;
};

export type StreakStanding = {
  rank: number;
  athleteId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  currentStreak: number;
  longestStreak: number;
  isViewer: boolean;
};

export type ViewerRole = "ATHLETE" | "COACH";

const DEFAULT_LIMIT = 10;
const ABSOLUTE_MAX_LIMIT = 50;

function clampLimit(input: number | undefined): number {
  if (!input || !Number.isFinite(input)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(input), 1), ABSOLUTE_MAX_LIMIT);
}

function isShareFlagOn(prefs: unknown, key: "sharePRs" | "shareStreaks"): boolean {
  if (!prefs || typeof prefs !== "object") return true;
  const root = prefs as Record<string, unknown>;
  const fp =
    root.feedPrivacy && typeof root.feedPrivacy === "object"
      ? (root.feedPrivacy as Record<string, unknown>)
      : {};
  // Default-on: only excluded when explicitly false.
  return fp[key] !== false;
}

/**
 * Top PRs across the coach's roster for a given event. Tie-breaking is
 * deterministic: distance desc → achievedAt asc (earliest hit wins) →
 * athleteId asc (stable). When ties cross the limit, the boundary tie is
 * either fully kept or fully dropped to avoid arbitrary truncation —
 * we cap at `limit` strictly, the asc-on-ties order makes the cut stable.
 */
export async function getTeamLeaderboardByEvent(args: {
  coachId: string;
  event: string;
  viewerAthleteId?: string | null;
  viewerRole: ViewerRole;
  limit?: number;
}): Promise<LeaderboardEntry[]> {
  const limit = clampLimit(args.limit);

  // Pull all PRs for this event across the team, with the athlete's
  // privacy prefs in one query. Filtering in JS keeps the SQL simple and
  // lets us use the canonical `parseFeedPrivacy` shape without trying to
  // express it as a Prisma JSON path filter.
  const rows = await prisma.throwsPR.findMany({
    where: {
      event: args.event,
      athlete: { coachId: args.coachId },
    },
    select: {
      id: true,
      event: true,
      implement: true,
      distance: true,
      achievedAt: true,
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          notificationPreferences: true,
        },
      },
    },
  });

  const filtered =
    args.viewerRole === "COACH"
      ? rows
      : rows.filter((r) => isShareFlagOn(r.athlete.notificationPreferences, "sharePRs"));

  // Sort: distance desc → achievedAt asc → athleteId asc.
  filtered.sort((a, b) => {
    if (a.distance !== b.distance) return b.distance - a.distance;
    if (a.achievedAt !== b.achievedAt) return a.achievedAt < b.achievedAt ? -1 : 1;
    return a.athlete.id.localeCompare(b.athlete.id);
  });

  const top = filtered.slice(0, limit);
  return top.map((r, i) => ({
    rank: i + 1,
    athleteId: r.athlete.id,
    firstName: r.athlete.firstName,
    lastName: r.athlete.lastName,
    avatarUrl: r.athlete.avatarUrl,
    event: r.event,
    implement: r.implement,
    distance: Math.round(r.distance * 100) / 100,
    achievedAt: r.achievedAt,
    isViewer: args.viewerAthleteId !== undefined && r.athlete.id === args.viewerAthleteId,
  }));
}

/**
 * Active-streak standings across the coach's roster. Athletes with zero
 * streak are included only when the requested limit isn't satisfied by
 * non-zero streaks — they're a placeholder, not a leaderboard entry, so
 * we filter them out and return whatever exists.
 */
export async function getTeamStreakStandings(args: {
  coachId: string;
  viewerAthleteId?: string | null;
  viewerRole: ViewerRole;
  limit?: number;
}): Promise<StreakStanding[]> {
  const limit = clampLimit(args.limit);

  const rows = await prisma.athleteProfile.findMany({
    where: {
      coachId: args.coachId,
      currentStreak: { gt: 0 },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      currentStreak: true,
      longestStreak: true,
      notificationPreferences: true,
    },
  });

  const filtered =
    args.viewerRole === "COACH"
      ? rows
      : rows.filter((r) => isShareFlagOn(r.notificationPreferences, "shareStreaks"));

  // currentStreak desc → longestStreak desc → id asc (stable).
  filtered.sort((a, b) => {
    if (a.currentStreak !== b.currentStreak) return b.currentStreak - a.currentStreak;
    if (a.longestStreak !== b.longestStreak) return b.longestStreak - a.longestStreak;
    return a.id.localeCompare(b.id);
  });

  const top = filtered.slice(0, limit);
  return top.map((r, i) => ({
    rank: i + 1,
    athleteId: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    avatarUrl: r.avatarUrl,
    currentStreak: r.currentStreak,
    longestStreak: r.longestStreak,
    isViewer: args.viewerAthleteId !== undefined && r.id === args.viewerAthleteId,
  }));
}
