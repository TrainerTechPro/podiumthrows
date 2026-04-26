import { describe, it, expect } from "vitest";
import {
  decideOnActivity,
  decideOnFreezeRequest,
  crossedMilestone,
  subtractOneDayLocal,
  STREAK_MILESTONES,
} from "@/lib/athlete/streak-engine";

/* ─── subtractOneDayLocal ────────────────────────────────────────────────── */

describe("subtractOneDayLocal", () => {
  it("subtracts a day within a month", () => {
    expect(subtractOneDayLocal("2026-04-15")).toBe("2026-04-14");
  });

  it("crosses a month boundary", () => {
    expect(subtractOneDayLocal("2026-04-01")).toBe("2026-03-31");
  });

  it("crosses a year boundary", () => {
    expect(subtractOneDayLocal("2026-01-01")).toBe("2025-12-31");
  });

  it("handles February in a leap year", () => {
    expect(subtractOneDayLocal("2024-03-01")).toBe("2024-02-29");
  });

  it("handles February in a non-leap year", () => {
    expect(subtractOneDayLocal("2025-03-01")).toBe("2025-02-28");
  });
});

/* ─── crossedMilestone ───────────────────────────────────────────────────── */

describe("crossedMilestone", () => {
  it("returns null when current <= prev", () => {
    expect(crossedMilestone(7, 7)).toBeNull();
    expect(crossedMilestone(7, 6)).toBeNull();
  });

  it("returns null when no threshold sits in (prev, current]", () => {
    expect(crossedMilestone(8, 9)).toBeNull();
    expect(crossedMilestone(15, 16)).toBeNull();
  });

  it("returns the threshold when extending across one", () => {
    expect(crossedMilestone(2, 3)).toBe(3);
    expect(crossedMilestone(6, 7)).toBe(7);
    expect(crossedMilestone(13, 14)).toBe(14);
    expect(crossedMilestone(29, 30)).toBe(30);
    expect(crossedMilestone(99, 100)).toBe(100);
  });

  it("returns the LARGEST crossed when a +N jump straddles two", () => {
    // Hypothetical: athlete jumped from 0 to 14 (engine guards this in practice
    // but we want the helper to be safe regardless).
    expect(crossedMilestone(0, 14)).toBe(14);
  });

  it("matches every threshold listed in STREAK_MILESTONES", () => {
    for (const m of STREAK_MILESTONES) {
      expect(crossedMilestone(m - 1, m)).toBe(m);
    }
  });
});

/* ─── decideOnActivity ───────────────────────────────────────────────────── */

describe("decideOnActivity", () => {
  it("first-ever activity starts a streak at 1", () => {
    const decision = decideOnActivity({
      todayLocal: "2026-04-26",
      lastActivityLocal: null,
      lastFreezeLocal: null,
      currentStreak: 0,
    });
    expect(decision).toEqual({ kind: "reset", from: 0, to: 1 });
  });

  it("second activity same day is a no-op", () => {
    const decision = decideOnActivity({
      todayLocal: "2026-04-26",
      lastActivityLocal: "2026-04-26",
      lastFreezeLocal: null,
      currentStreak: 5,
    });
    expect(decision.kind).toBe("noop");
  });

  it("activity day after yesterday extends the streak", () => {
    const decision = decideOnActivity({
      todayLocal: "2026-04-26",
      lastActivityLocal: "2026-04-25",
      lastFreezeLocal: null,
      currentStreak: 5,
    });
    expect(decision).toEqual({ kind: "extend", from: 5, to: 6 });
  });

  it("activity after a 2-day gap resets to 1", () => {
    const decision = decideOnActivity({
      todayLocal: "2026-04-26",
      lastActivityLocal: "2026-04-23",
      lastFreezeLocal: null,
      currentStreak: 10,
    });
    expect(decision).toEqual({ kind: "reset", from: 10, to: 1 });
  });

  it("activity preserved by yesterday's freeze still extends", () => {
    // Athlete trained Mon, froze Tue, trains Wed → Wed extends to streak+1.
    const decision = decideOnActivity({
      todayLocal: "2026-04-26",
      lastActivityLocal: "2026-04-24",
      lastFreezeLocal: "2026-04-25",
      currentStreak: 7,
    });
    expect(decision).toEqual({ kind: "extend", from: 7, to: 8 });
  });

  it("freeze used today makes activity a no-op", () => {
    const decision = decideOnActivity({
      todayLocal: "2026-04-26",
      lastActivityLocal: "2026-04-25",
      lastFreezeLocal: "2026-04-26",
      currentStreak: 7,
    });
    expect(decision.kind).toBe("noop");
  });

  it("freeze older than yesterday cannot bridge a 2-day gap", () => {
    // Athlete froze 2 days ago, no activity yesterday, trains today → reset.
    const decision = decideOnActivity({
      todayLocal: "2026-04-26",
      lastActivityLocal: "2026-04-23",
      lastFreezeLocal: "2026-04-24",
      currentStreak: 5,
    });
    expect(decision).toEqual({ kind: "reset", from: 5, to: 1 });
  });
});

/* ─── decideOnFreezeRequest ──────────────────────────────────────────────── */

describe("decideOnFreezeRequest", () => {
  it("denies if athlete has no streak", () => {
    expect(
      decideOnFreezeRequest({
        todayLocal: "2026-04-26",
        lastActivityLocal: null,
        lastFreezeLocal: null,
        currentStreak: 0,
        freezesAvailable: 1,
      })
    ).toEqual({ kind: "denied", reason: "no-streak" });
  });

  it("denies if already frozen today (idempotent rebound)", () => {
    expect(
      decideOnFreezeRequest({
        todayLocal: "2026-04-26",
        lastActivityLocal: "2026-04-25",
        lastFreezeLocal: "2026-04-26",
        currentStreak: 5,
        freezesAvailable: 1,
      })
    ).toEqual({ kind: "denied", reason: "already-frozen-today" });
  });

  it("denies if no freezes are available this week", () => {
    expect(
      decideOnFreezeRequest({
        todayLocal: "2026-04-26",
        lastActivityLocal: "2026-04-25",
        lastFreezeLocal: null,
        currentStreak: 5,
        freezesAvailable: 0,
      })
    ).toEqual({ kind: "denied", reason: "no-freezes-available" });
  });

  it("applies when athlete has a streak and a freeze in the bank", () => {
    expect(
      decideOnFreezeRequest({
        todayLocal: "2026-04-26",
        lastActivityLocal: "2026-04-25",
        lastFreezeLocal: null,
        currentStreak: 5,
        freezesAvailable: 1,
      })
    ).toEqual({ kind: "applied" });
  });
});

/* ─── End-to-end simulation ──────────────────────────────────────────────── */

describe("simulation: 7 consecutive days", () => {
  it("reaches 7 with the 7-day milestone crossed on day 7", () => {
    // Walk from 0 streak through 7 consecutive days.
    let lastActivityLocal: string | null = null;
    let currentStreak = 0;
    let crossedAtSeven: number | null = null;

    const days = [
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
      "2026-04-25",
      "2026-04-26",
    ];

    for (const today of days) {
      const decision = decideOnActivity({
        todayLocal: today,
        lastActivityLocal,
        lastFreezeLocal: null,
        currentStreak,
      });
      if (decision.kind !== "noop") {
        const next = decision.to;
        const m = crossedMilestone(currentStreak, next);
        if (m === 7) crossedAtSeven = m;
        currentStreak = next;
      }
      lastActivityLocal = today;
    }

    expect(currentStreak).toBe(7);
    expect(crossedAtSeven).toBe(7);
  });
});

describe("simulation: skip day 4 with no freeze → resets", () => {
  it("breaks and rebuilds at day 1", () => {
    let lastActivityLocal: string | null = null;
    let currentStreak = 0;

    // Days 1-3: train.
    for (const day of ["2026-04-20", "2026-04-21", "2026-04-22"]) {
      const d = decideOnActivity({
        todayLocal: day,
        lastActivityLocal,
        lastFreezeLocal: null,
        currentStreak,
      });
      if (d.kind !== "noop") currentStreak = d.to;
      lastActivityLocal = day;
    }
    expect(currentStreak).toBe(3);

    // Day 4: skipped (no activity, no freeze).
    // Day 5: train — should RESET because the gap is >1 day from lastActivity.
    const d5 = decideOnActivity({
      todayLocal: "2026-04-24",
      lastActivityLocal,
      lastFreezeLocal: null,
      currentStreak,
    });
    expect(d5).toEqual({ kind: "reset", from: 3, to: 1 });
  });
});

describe("simulation: freeze on a rest day → streak holds", () => {
  it("preserves the streak when a single day is frozen", () => {
    // Train days 1-3, freeze day 4, train day 5 → streak is 4 (not 5: freeze
    // preserves but does not credit; day 5's activity is the +1).
    const lastActivityLocal = "2026-04-22"; // day 3
    const lastFreezeLocal = "2026-04-23"; // day 4 covered by freeze
    const currentStreak = 3;

    const d5 = decideOnActivity({
      todayLocal: "2026-04-24",
      lastActivityLocal,
      lastFreezeLocal,
      currentStreak,
    });
    expect(d5).toEqual({ kind: "extend", from: 3, to: 4 });
  });
});
