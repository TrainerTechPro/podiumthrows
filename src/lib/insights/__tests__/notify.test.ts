// src/lib/insights/__tests__/notify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  createNotification: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...a: unknown[]) => mocks.findUnique(...a) },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: (...a: unknown[]) => mocks.createNotification(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}));

import { notifyInsightsNew } from "../notify";

describe("notifyInsightsNew", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires one notification each for athlete and linked coach on a single new insight", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "a1",
      coachId: "c1",
      isSelfCoached: false,
      user: { email: "a@test.com" },
    });

    await notifyInsightsNew("a1", [
      { category: "TRAINING_PATTERN", title: "Best shot put follow 8kg weeks", body: "..." },
    ]);

    expect(mocks.createNotification).toHaveBeenCalledTimes(2);

    const athleteCall = mocks.createNotification.mock.calls.find(
      (c) => c[0].athleteProfileId === "a1"
    );
    expect(athleteCall?.[0]).toMatchObject({
      type: "INSIGHT_NEW",
      title: "New insight",
      body: "Best shot put follow 8kg weeks",
      athleteProfileId: "a1",
      metadata: expect.objectContaining({ href: "/athlete/dashboard", insightCount: 1 }),
    });

    const coachCall = mocks.createNotification.mock.calls.find((c) => c[0].coachId === "c1");
    expect(coachCall?.[0]).toMatchObject({
      type: "INSIGHT_NEW",
      title: "New insight · a@test.com",
      coachId: "c1",
      metadata: expect.objectContaining({ href: "/coach/athletes/a1/insights", insightCount: 1 }),
    });
  });

  it("suppresses coach notification when athlete is self-coached", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "a1",
      coachId: "c1",
      isSelfCoached: true,
      user: { email: "a@test.com" },
    });

    await notifyInsightsNew("a1", [{ category: "TRAINING_PATTERN", title: "T1", body: "b" }]);

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification.mock.calls[0][0].athleteProfileId).toBe("a1");
  });

  it("renders count-aware title and body for multi-insight batches", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "a1",
      coachId: "c1",
      isSelfCoached: false,
      user: { email: "a@test.com" },
    });

    await notifyInsightsNew("a1", [
      { category: "TRAINING_PATTERN", title: "First title", body: "b1" },
      { category: "LIFT_THROW", title: "Second title", body: "b2" },
      { category: "READINESS_COMPETITION", title: "Third title", body: "b3" },
    ]);

    const athleteCall = mocks.createNotification.mock.calls.find(
      (c) => c[0].athleteProfileId === "a1"
    );
    expect(athleteCall?.[0].title).toBe("3 new insights");
    expect(athleteCall?.[0].body).toBe("Including: First title");
    expect(athleteCall?.[0].metadata).toMatchObject({
      insightCount: 3,
      categories: ["TRAINING_PATTERN", "LIFT_THROW", "READINESS_COMPETITION"],
    });
  });

  it("swallows errors from createNotification (never throws)", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "a1",
      coachId: "c1",
      isSelfCoached: false,
      user: { email: "a@test.com" },
    });
    mocks.createNotification.mockRejectedValueOnce(new Error("db down"));

    await expect(
      notifyInsightsNew("a1", [{ category: "TRAINING_PATTERN", title: "t", body: "b" }])
    ).resolves.toBeUndefined();
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it("returns silently if the athlete profile doesn't exist", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await notifyInsightsNew("a1", [{ category: "TRAINING_PATTERN", title: "t", body: "b" }]);

    expect(mocks.createNotification).not.toHaveBeenCalled();
  });
});
