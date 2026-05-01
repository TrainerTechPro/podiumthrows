import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prFindMany: vi.fn(),
  athleteFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    // Catalog-keyed PRs (post-Phase-D). Mock returns rows in the
    // AthleteImplementPR + Implement include shape.
    athleteImplementPR: { findMany: (...a: unknown[]) => mocks.prFindMany(...a) },
    athleteProfile: { findMany: (...a: unknown[]) => mocks.athleteFindMany(...a) },
  },
}));

import { getTeamLeaderboardByEvent, getTeamStreakStandings } from "../team-leaderboard";

const COACH_ID = "coach_1";

const PR_ATHLETE = (id: string, firstName: string, lastName: string, prefs: unknown = null) => ({
  id,
  firstName,
  lastName,
  avatarUrl: null,
  notificationPreferences: prefs,
});

/** Build a catalog-keyed PR row in the shape the migrated query returns. */
const CATALOG_PR = (
  throwType: "HAMMER" | "SHOT" | "DISCUS" | "JAVELIN",
  displayLabel: string,
  distance: number,
  achievedAt: string,
  athlete: ReturnType<typeof PR_ATHLETE>
) => ({
  id: `pr_${athlete.id}_${throwType}`,
  bestDistance: distance,
  bestAchievedAt: new Date(achievedAt + "T00:00:00"),
  implement: { throwType, displayLabel },
  athlete,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTeamLeaderboardByEvent", () => {
  it("returns top N PRs sorted distance desc, ties broken by earlier achievedAt then athleteId", async () => {
    mocks.prFindMany.mockResolvedValue([
      CATALOG_PR("HAMMER", "7.26 kg", 60.5, "2026-04-10", PR_ATHLETE("ath_b", "Bryce", "B")),
      CATALOG_PR("HAMMER", "7.26 kg", 70.0, "2026-04-15", PR_ATHLETE("ath_c", "Cory", "C")),
      CATALOG_PR("HAMMER", "7.26 kg", 70.0, "2026-04-12", PR_ATHLETE("ath_a", "Ari", "A")),
      CATALOG_PR("HAMMER", "7.26 kg", 50.0, "2026-04-01", PR_ATHLETE("ath_d", "Dee", "D")),
    ]);

    const top = await getTeamLeaderboardByEvent({
      coachId: COACH_ID,
      event: "HAMMER",
      viewerRole: "ATHLETE",
      limit: 10,
    });

    expect(top.map((e) => e.athleteId)).toEqual(["ath_a", "ath_c", "ath_b", "ath_d"]);
    expect(top[0].rank).toBe(1);
    expect(top[3].rank).toBe(4);
  });

  it("filters out athletes with feedPrivacy.sharePRs=false for ATHLETE callers", async () => {
    mocks.prFindMany.mockResolvedValue([
      CATALOG_PR("SHOT", "7.26 kg", 18.0, "2026-04-01", PR_ATHLETE("ath_open", "Open", "A")),
      CATALOG_PR(
        "SHOT",
        "7.26 kg",
        19.5,
        "2026-04-02",
        PR_ATHLETE("ath_hidden", "Hidden", "X", { feedPrivacy: { sharePRs: false } })
      ),
    ]);

    const athleteView = await getTeamLeaderboardByEvent({
      coachId: COACH_ID,
      event: "SHOT_PUT",
      viewerRole: "ATHLETE",
    });
    expect(athleteView.map((e) => e.athleteId)).toEqual(["ath_open"]);

    // Coach view bypasses privacy.
    const coachView = await getTeamLeaderboardByEvent({
      coachId: COACH_ID,
      event: "SHOT_PUT",
      viewerRole: "COACH",
    });
    expect(coachView.map((e) => e.athleteId)).toEqual(["ath_hidden", "ath_open"]);
  });

  it("flags isViewer=true on the requesting athlete's row", async () => {
    mocks.prFindMany.mockResolvedValue([
      CATALOG_PR("DISCUS", "2 kg", 60, "2026-04-01", PR_ATHLETE("ath_self", "Me", "M")),
    ]);

    const top = await getTeamLeaderboardByEvent({
      coachId: COACH_ID,
      event: "DISCUS",
      viewerAthleteId: "ath_self",
      viewerRole: "ATHLETE",
    });

    expect(top[0].isViewer).toBe(true);
  });

  it("clamps limit between 1 and 50", async () => {
    mocks.prFindMany.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) =>
        CATALOG_PR(
          "JAVELIN",
          "800 g",
          80 - i * 0.1,
          "2026-04-01",
          PR_ATHLETE(`ath_${i}`, `A${i}`, "X")
        )
      )
    );

    const tooHigh = await getTeamLeaderboardByEvent({
      coachId: COACH_ID,
      event: "JAVELIN",
      viewerRole: "ATHLETE",
      limit: 999,
    });
    expect(tooHigh).toHaveLength(50);

    const negative = await getTeamLeaderboardByEvent({
      coachId: COACH_ID,
      event: "JAVELIN",
      viewerRole: "ATHLETE",
      limit: -3,
    });
    // Negative input is clamped to the minimum of 1, not the default —
    // a deliberate "you asked for nothing, you get the leader only" UX.
    expect(negative).toHaveLength(1);
  });
});

describe("getTeamStreakStandings", () => {
  it("sorts by currentStreak desc, longestStreak desc, id asc", async () => {
    mocks.athleteFindMany.mockResolvedValue([
      {
        id: "z",
        firstName: "Zara",
        lastName: "Z",
        avatarUrl: null,
        currentStreak: 10,
        longestStreak: 15,
        notificationPreferences: null,
      },
      {
        id: "a",
        firstName: "Ari",
        lastName: "A",
        avatarUrl: null,
        currentStreak: 14,
        longestStreak: 14,
        notificationPreferences: null,
      },
      {
        id: "b",
        firstName: "Bo",
        lastName: "B",
        avatarUrl: null,
        currentStreak: 14,
        longestStreak: 20,
        notificationPreferences: null,
      },
    ]);

    const list = await getTeamStreakStandings({
      coachId: COACH_ID,
      viewerRole: "ATHLETE",
    });

    // 14d (longest 20) > 14d (longest 14) > 10d
    expect(list.map((e) => e.athleteId)).toEqual(["b", "a", "z"]);
    expect(list[0].rank).toBe(1);
  });

  it("filters out shareStreaks=false for athletes; coach sees them", async () => {
    mocks.athleteFindMany.mockResolvedValue([
      {
        id: "open",
        firstName: "Open",
        lastName: "X",
        avatarUrl: null,
        currentStreak: 5,
        longestStreak: 5,
        notificationPreferences: null,
      },
      {
        id: "hidden",
        firstName: "Hidden",
        lastName: "X",
        avatarUrl: null,
        currentStreak: 100,
        longestStreak: 100,
        notificationPreferences: { feedPrivacy: { shareStreaks: false } },
      },
    ]);

    const athleteView = await getTeamStreakStandings({
      coachId: COACH_ID,
      viewerRole: "ATHLETE",
    });
    expect(athleteView.map((e) => e.athleteId)).toEqual(["open"]);

    const coachView = await getTeamStreakStandings({
      coachId: COACH_ID,
      viewerRole: "COACH",
    });
    expect(coachView.map((e) => e.athleteId)).toEqual(["hidden", "open"]);
  });

  it("flags isViewer=true on the requesting athlete's row", async () => {
    mocks.athleteFindMany.mockResolvedValue([
      {
        id: "me",
        firstName: "Me",
        lastName: "M",
        avatarUrl: null,
        currentStreak: 7,
        longestStreak: 7,
        notificationPreferences: null,
      },
    ]);

    const list = await getTeamStreakStandings({
      coachId: COACH_ID,
      viewerAthleteId: "me",
      viewerRole: "ATHLETE",
    });

    expect(list[0].isViewer).toBe(true);
  });
});
