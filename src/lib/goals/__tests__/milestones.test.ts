import { describe, it, expect } from "vitest";
import {
  computeProgressPct,
  newMilestonesCrossed,
  buildCelebration,
  celebrationCopy,
} from "@/lib/goals/milestones";

describe("computeProgressPct", () => {
  it("returns 50 for halfway with null starting", () => {
    expect(computeProgressPct({ startingValue: null, currentValue: 30, targetValue: 60 })).toBe(50);
  });

  it("uses startingValue as baseline when set (delta-from-baseline model)", () => {
    expect(computeProgressPct({ startingValue: 20, currentValue: 30, targetValue: 60 })).toBe(25);
  });

  it("clamps to [0, 100]", () => {
    expect(computeProgressPct({ startingValue: 0, currentValue: 90, targetValue: 60 })).toBe(100);
    expect(computeProgressPct({ startingValue: 0, currentValue: -5, targetValue: 60 })).toBe(0);
  });

  it("returns 0 when range is non-positive", () => {
    expect(computeProgressPct({ startingValue: 60, currentValue: 30, targetValue: 60 })).toBe(0);
    expect(computeProgressPct({ startingValue: null, currentValue: 0, targetValue: 0 })).toBe(0);
  });

  it("preserves 0 currentValue (CLAUDE.md rule 3)", () => {
    expect(computeProgressPct({ startingValue: null, currentValue: 0, targetValue: 100 })).toBe(0);
  });
});

describe("newMilestonesCrossed", () => {
  it("returns thresholds crossed in ascending order", () => {
    expect(newMilestonesCrossed(80, [])).toEqual([25, 50, 75]);
  });

  it("returns 100 only when reached", () => {
    expect(newMilestonesCrossed(100, [25, 50, 75])).toEqual([100]);
    expect(newMilestonesCrossed(99, [25, 50, 75])).toEqual([]);
  });

  it("excludes already-celebrated thresholds", () => {
    expect(newMilestonesCrossed(60, [25, 50])).toEqual([]);
    expect(newMilestonesCrossed(76, [25, 50])).toEqual([75]);
  });

  it("returns [] when below 25%", () => {
    expect(newMilestonesCrossed(24, [])).toEqual([]);
  });
});

describe("buildCelebration", () => {
  const baseGoal = {
    id: "g1",
    title: "60m Hammer",
    unit: "meters",
    targetValue: 60,
    startingValue: null,
    celebratedMilestones: [] as number[],
  };

  it("returns null when no new milestones cross", () => {
    expect(buildCelebration(baseGoal, 5)).toBeNull();
  });

  it("flags 50% crossing", () => {
    const c = buildCelebration(baseGoal, 30);
    expect(c).not.toBeNull();
    expect(c!.thresholds).toEqual([25, 50]);
    expect(c!.completed).toBe(false);
    expect(c!.progressPct).toBe(50);
  });

  it("flags goal completion at 100%", () => {
    const c = buildCelebration(baseGoal, 60);
    expect(c).not.toBeNull();
    expect(c!.thresholds).toEqual([25, 50, 75, 100]);
    expect(c!.completed).toBe(true);
  });

  it("respects already-celebrated thresholds", () => {
    const c = buildCelebration({ ...baseGoal, celebratedMilestones: [25, 50, 75] }, 45);
    // 45/60 = 75%, but 75 already celebrated → no new milestones
    expect(c).toBeNull();
  });
});

describe("celebrationCopy", () => {
  const base = {
    goalId: "g1",
    goalTitle: "60m Hammer",
    unit: "meters",
    targetValue: 60,
    currentValue: 30,
    progressPct: 50,
    completed: false,
  };

  it("uses 'Halfway' headline for 50% threshold", () => {
    const copy = celebrationCopy({ ...base, thresholds: [25, 50] });
    expect(copy.title).toMatch(/halfway/i);
    expect(copy.body).toContain("30");
  });

  it("uses celebration headline for goal completion", () => {
    const copy = celebrationCopy({
      ...base,
      currentValue: 60,
      progressPct: 100,
      completed: true,
      thresholds: [25, 50, 75, 100],
    });
    expect(copy.title).toMatch(/complete/i);
  });

  it("uses three-quarters headline for 75% threshold", () => {
    const copy = celebrationCopy({
      ...base,
      currentValue: 45,
      progressPct: 75,
      thresholds: [75],
    });
    expect(copy.title).toMatch(/three-quarters/i);
  });
});
