// src/lib/insights/__tests__/persist.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn(),
  notifyInsightsNew: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteInsight: {
      findMany: (...a: unknown[]) => mocks.findMany(...a),
      createMany: (...a: unknown[]) => mocks.createMany(...a),
    },
  },
}));

vi.mock("../notify", () => ({
  notifyInsightsNew: (...a: unknown[]) => mocks.notifyInsightsNew(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}));

// Passthrough: let the wrapped promise resolve/reject naturally so the
// inner .catch() runs and we can assert logger error vs notify calls.
vi.mock("@vercel/functions", () => ({
  waitUntil: (p: Promise<unknown>) => p,
}));

import { persistInsights } from "../persist";

function row(
  overrides: Partial<Parameters<typeof persistInsights>[1][number]> = {}
): Parameters<typeof persistInsights>[1][number] {
  return {
    category: "TRAINING_PATTERN",
    metric: "m1",
    event: null,
    title: "T",
    body: "B",
    detail: null,
    confidenceBand: "MEDIUM",
    dataPoints: 10,
    coefficient: 0.5,
    effectSize: null,
    effectUnit: null,
    evidence: {},
    renderInputs: {},
    triggerKind: "MEET_COMPLETE",
    triggerMeetId: "m1",
    ...overrides,
  };
}

describe("persistInsights", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits on empty input", async () => {
    const count = await persistInsights("a1", []);
    expect(count).toBe(0);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.notifyInsightsNew).not.toHaveBeenCalled();
  });

  it("fires notification for every item when no prior slots exist", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.createMany.mockResolvedValue({ count: 2 });

    await persistInsights("a1", [
      row({ metric: "m1", category: "TRAINING_PATTERN" }),
      row({ metric: "m2", category: "LIFT_THROW" }),
    ]);

    expect(mocks.notifyInsightsNew).toHaveBeenCalledTimes(1);
    const args = mocks.notifyInsightsNew.mock.calls[0];
    expect(args[0]).toBe("a1");
    expect(args[1]).toHaveLength(2);
  });

  it("skips notification when every slot already exists", async () => {
    mocks.findMany.mockResolvedValue([
      { category: "TRAINING_PATTERN", metric: "m1" },
      { category: "LIFT_THROW", metric: "m2" },
    ]);
    mocks.createMany.mockResolvedValue({ count: 2 });

    await persistInsights("a1", [
      row({ metric: "m1", category: "TRAINING_PATTERN" }),
      row({ metric: "m2", category: "LIFT_THROW" }),
    ]);

    expect(mocks.notifyInsightsNew).not.toHaveBeenCalled();
  });

  it("filters notification to only new-slot items in a mixed batch", async () => {
    mocks.findMany.mockResolvedValue([{ category: "TRAINING_PATTERN", metric: "m1" }]);
    mocks.createMany.mockResolvedValue({ count: 2 });

    await persistInsights("a1", [
      row({ metric: "m1", category: "TRAINING_PATTERN" }),
      row({ metric: "m2", category: "LIFT_THROW" }),
    ]);

    expect(mocks.notifyInsightsNew).toHaveBeenCalledTimes(1);
    const args = mocks.notifyInsightsNew.mock.calls[0];
    expect(args[1]).toHaveLength(1);
    expect(args[1][0].metric).toBe("m2");
  });

  it("returns createMany count even when notifyInsightsNew rejects", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.createMany.mockResolvedValue({ count: 1 });
    mocks.notifyInsightsNew.mockRejectedValueOnce(new Error("boom"));

    const count = await persistInsights("a1", [row()]);
    // Flush any pending microtasks so the .catch() attached to the void call runs
    await new Promise((r) => setTimeout(r, 0));

    expect(count).toBe(1);
    expect(mocks.loggerError).toHaveBeenCalled();
  });
});
