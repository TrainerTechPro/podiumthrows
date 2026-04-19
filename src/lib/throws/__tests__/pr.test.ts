import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  throwsPRFindUnique: vi.fn(),
  throwsPRFindMany: vi.fn(),
  throwsPRUpsert: vi.fn(),
  throwsPRCreate: vi.fn(),
  throwsPRUpdate: vi.fn(),
  throwsPRDelete: vi.fn(),
  throwLogFindFirst: vi.fn(),
  throwLogUpdateMany: vi.fn(),
  throwLogUpdate: vi.fn(),
  throwLogGroupBy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const txClient = {
    throwsPR: {
      findUnique: (...a: unknown[]) => mocks.throwsPRFindUnique(...a),
      findMany: (...a: unknown[]) => mocks.throwsPRFindMany(...a),
      upsert: (...a: unknown[]) => mocks.throwsPRUpsert(...a),
      create: (...a: unknown[]) => mocks.throwsPRCreate(...a),
      update: (...a: unknown[]) => mocks.throwsPRUpdate(...a),
      delete: (...a: unknown[]) => mocks.throwsPRDelete(...a),
    },
    throwLog: {
      findFirst: (...a: unknown[]) => mocks.throwLogFindFirst(...a),
      updateMany: (...a: unknown[]) => mocks.throwLogUpdateMany(...a),
      update: (...a: unknown[]) => mocks.throwLogUpdate(...a),
      groupBy: (...a: unknown[]) => mocks.throwLogGroupBy(...a),
    },
  };

  return {
    default: {
      throwsPR: txClient.throwsPR,
      throwLog: txClient.throwLog,
      $transaction: async (arg: unknown) => {
        if (typeof arg === "function") {
          return (arg as (tx: typeof txClient) => Promise<unknown>)(txClient);
        }
        return arg;
      },
    },
  };
});

import { recordThrow, checkIsPersonalBest, recalculatePRs } from "@/lib/throws/pr";

// ── Tests ────────────────────────────────────────────────────────────────

describe("recordThrow — atomic PR write", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flags a new PR when no existing ThrowsPR row and no legacy ThrowLog data", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue(null);
    mocks.throwLogFindFirst.mockResolvedValue(null);
    mocks.throwLogUpdateMany.mockResolvedValue({ count: 0 });
    mocks.throwsPRUpsert.mockResolvedValue({
      id: "pr1",
      distance: 15.5,
      implement: "7.26kg",
      achievedAt: "2026-04-19",
    });

    const result = await recordThrow({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 7.26,
      distance: 15.5,
    });

    expect(result.isPersonalBest).toBe(true);
    expect(result.previousDistance).toBeNull();
    expect(result.pr?.id).toBe("pr1");
    expect(mocks.throwsPRUpsert).toHaveBeenCalledOnce();
    expect(mocks.throwLogUpdateMany).toHaveBeenCalledOnce();
  });

  it("flags a new PR when new throw beats existing ThrowsPR", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue({ id: "pr1", distance: 14.0 });
    mocks.throwLogUpdateMany.mockResolvedValue({ count: 1 });
    mocks.throwsPRUpsert.mockResolvedValue({
      id: "pr1",
      distance: 15.5,
      implement: "7.26kg",
      achievedAt: "2026-04-19",
    });

    const result = await recordThrow({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 7.26,
      distance: 15.5,
    });

    expect(result.isPersonalBest).toBe(true);
    expect(result.previousDistance).toBe(14.0);
    expect(mocks.throwsPRUpsert).toHaveBeenCalledOnce();
  });

  it("does NOT flag a PR when new throw is lower than existing", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue({ id: "pr1", distance: 16.0 });

    const result = await recordThrow({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 7.26,
      distance: 15.0,
    });

    expect(result.isPersonalBest).toBe(false);
    expect(result.previousDistance).toBe(16.0);
    expect(mocks.throwsPRUpsert).not.toHaveBeenCalled();
    expect(mocks.throwLogUpdateMany).not.toHaveBeenCalled();
  });

  it("falls back to legacy ThrowLog when ThrowsPR row does not exist", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue(null);
    mocks.throwLogFindFirst.mockResolvedValue({ distance: 15.5 });

    const result = await recordThrow({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 7.26,
      distance: 15.0,
    });

    expect(result.isPersonalBest).toBe(false);
    expect(result.previousDistance).toBe(15.5);
    expect(mocks.throwsPRUpsert).not.toHaveBeenCalled();
  });

  it("preserves custom implementLabel for non-kg units (e.g. '14lbs')", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue(null);
    mocks.throwLogFindFirst.mockResolvedValue(null);
    mocks.throwLogUpdateMany.mockResolvedValue({ count: 0 });
    mocks.throwsPRUpsert.mockResolvedValue({
      id: "pr1",
      distance: 15.5,
      implement: "14lbs",
      achievedAt: "2026-04-19",
    });

    await recordThrow({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 6.35,
      implementLabel: "14lbs",
      distance: 15.5,
    });

    const upsertArg = mocks.throwsPRUpsert.mock.calls[0][0];
    expect(upsertArg.where.athleteId_event_implement.implement).toBe("14lbs");
    expect(upsertArg.create.implement).toBe("14lbs");
    expect(upsertArg.create.distance).toBe(15.5);
  });

  it("honors source='COMPETITION'", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue(null);
    mocks.throwLogFindFirst.mockResolvedValue(null);
    mocks.throwLogUpdateMany.mockResolvedValue({ count: 0 });
    mocks.throwsPRUpsert.mockResolvedValue({
      id: "pr1",
      distance: 18.5,
      implement: "7.26kg",
      achievedAt: "2026-04-19",
    });

    await recordThrow({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 7.26,
      distance: 18.5,
      source: "COMPETITION",
      achievedAt: "2026-04-15",
    });

    const upsertArg = mocks.throwsPRUpsert.mock.calls[0][0];
    expect(upsertArg.create.source).toBe("COMPETITION");
    expect(upsertArg.update.source).toBe("COMPETITION");
    expect(upsertArg.create.achievedAt).toBe("2026-04-15");
  });

  it("defaults implementLabel to `${kg}kg` when not provided", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue(null);
    mocks.throwLogFindFirst.mockResolvedValue(null);
    mocks.throwLogUpdateMany.mockResolvedValue({ count: 0 });
    mocks.throwsPRUpsert.mockResolvedValue({
      id: "pr1",
      distance: 15.5,
      implement: "7.26kg",
      achievedAt: "2026-04-19",
    });

    await recordThrow({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 7.26,
      distance: 15.5,
    });

    const upsertArg = mocks.throwsPRUpsert.mock.calls[0][0];
    expect(upsertArg.where.athleteId_event_implement.implement).toBe("7.26kg");
  });

  it("unmarks previously-flagged ThrowLog rows before upserting", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue({ id: "pr1", distance: 14.0 });
    mocks.throwLogUpdateMany.mockResolvedValue({ count: 1 });
    mocks.throwsPRUpsert.mockResolvedValue({
      id: "pr1",
      distance: 15.5,
      implement: "7.26kg",
      achievedAt: "2026-04-19",
    });

    await recordThrow({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 7.26,
      distance: 15.5,
    });

    const updateManyArg = mocks.throwLogUpdateMany.mock.calls[0][0];
    expect(updateManyArg.where.athleteId).toBe("ath1");
    expect(updateManyArg.where.implementWeight).toBe(7.26);
    expect(updateManyArg.where.isPersonalBest).toBe(true);
    expect(updateManyArg.data.isPersonalBest).toBe(false);
  });
});

describe("checkIsPersonalBest — read-only check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns isPersonalBest=true for higher candidate", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue({ distance: 14.0 });

    const result = await checkIsPersonalBest({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 7.26,
      candidateDistance: 15.5,
    });

    expect(result.isPersonalBest).toBe(true);
    expect(result.previousDistance).toBe(14.0);
    expect(mocks.throwsPRUpsert).not.toHaveBeenCalled();
    expect(mocks.throwLogUpdateMany).not.toHaveBeenCalled();
  });

  it("returns isPersonalBest=false for lower candidate", async () => {
    mocks.throwsPRFindUnique.mockResolvedValue({ distance: 16.0 });

    const result = await checkIsPersonalBest({
      athleteId: "ath1",
      event: "SHOT_PUT",
      implementWeightKg: 7.26,
      candidateDistance: 15.0,
    });

    expect(result.isPersonalBest).toBe(false);
    expect(result.previousDistance).toBe(16.0);
  });
});

describe("recalculatePRs — edit/delete recovery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates existing ThrowsPR to match the remaining max ThrowLog", async () => {
    mocks.throwLogGroupBy.mockResolvedValue([
      { event: "SHOT_PUT", implementWeight: 7.26, _max: { distance: 14.0 } },
    ]);
    mocks.throwsPRFindMany.mockResolvedValue([
      { id: "pr1", event: "SHOT_PUT", implement: "7.26kg", distance: 15.5 },
    ]);
    mocks.throwsPRUpdate.mockResolvedValue({});
    mocks.throwLogUpdateMany.mockResolvedValue({ count: 1 });
    mocks.throwLogFindFirst.mockResolvedValue({ id: "tl1" });
    mocks.throwLogUpdate.mockResolvedValue({});

    const result = await recalculatePRs({ athleteId: "ath1" });

    expect(result.rebuilt).toBe(1);
    expect(result.deleted).toBe(0);
    expect(mocks.throwsPRUpdate).toHaveBeenCalledWith({
      where: { id: "pr1" },
      data: { distance: 14.0 },
    });
  });

  it("deletes orphan ThrowsPR rows when no remaining ThrowLogs", async () => {
    mocks.throwLogGroupBy.mockResolvedValue([]);
    mocks.throwsPRFindMany.mockResolvedValue([
      { id: "pr1", event: "SHOT_PUT", implement: "7.26kg", distance: 15.5 },
    ]);
    mocks.throwsPRDelete.mockResolvedValue({});

    const result = await recalculatePRs({ athleteId: "ath1" });

    expect(result.rebuilt).toBe(0);
    expect(result.deleted).toBe(1);
    expect(mocks.throwsPRDelete).toHaveBeenCalledWith({ where: { id: "pr1" } });
  });

  it("creates ThrowsPR rows for combos that don't have one yet", async () => {
    mocks.throwLogGroupBy.mockResolvedValue([
      { event: "DISCUS", implementWeight: 2.0, _max: { distance: 45.0 } },
    ]);
    mocks.throwsPRFindMany.mockResolvedValue([]);
    mocks.throwsPRCreate.mockResolvedValue({});
    mocks.throwLogUpdateMany.mockResolvedValue({ count: 0 });
    mocks.throwLogFindFirst.mockResolvedValue({ id: "tl1" });
    mocks.throwLogUpdate.mockResolvedValue({});

    const result = await recalculatePRs({ athleteId: "ath1" });

    expect(result.rebuilt).toBe(1);
    const createArg = mocks.throwsPRCreate.mock.calls[0][0];
    expect(createArg.data.event).toBe("DISCUS");
    expect(createArg.data.implement).toBe("2kg");
    expect(createArg.data.distance).toBe(45.0);
  });
});
