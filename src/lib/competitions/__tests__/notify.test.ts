import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateNotification = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { notifyCompetitionEvent } from "../notify";

describe("notifyCompetitionEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires PR notification to coach when athlete logs", async () => {
    mockFindUnique.mockResolvedValue({ id: "a1", coachId: "c1", isSelfCoached: false });
    await notifyCompetitionEvent({
      athleteId: "a1",
      actorRole: "ATHLETE",
      meetName: "Big Invite",
      competitionId: "m1",
      prCelebration: { event: "SHOT_PUT", oldPR: 18.0, newPR: 18.42 },
      isFirstThrow: false,
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "COMPETITION_PR",
        coachId: "c1",
      })
    );
  });

  it("fires PR notification to athlete when coach logs", async () => {
    mockFindUnique.mockResolvedValue({ id: "a1", coachId: "c1", isSelfCoached: false });
    await notifyCompetitionEvent({
      athleteId: "a1",
      actorRole: "COACH",
      meetName: "Big Invite",
      competitionId: "m1",
      prCelebration: { event: "SHOT_PUT", oldPR: 18.0, newPR: 18.42 },
      isFirstThrow: false,
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "COMPETITION_PR",
        athleteProfileId: "a1",
      })
    );
  });

  it("fires COMPETITION_LOGGED only on first throw", async () => {
    mockFindUnique.mockResolvedValue({ id: "a1", coachId: "c1", isSelfCoached: false });
    await notifyCompetitionEvent({
      athleteId: "a1",
      actorRole: "ATHLETE",
      meetName: "Big Invite",
      competitionId: "m1",
      prCelebration: null,
      isFirstThrow: true,
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "COMPETITION_LOGGED" })
    );

    mockCreateNotification.mockClear();
    await notifyCompetitionEvent({
      athleteId: "a1",
      actorRole: "ATHLETE",
      meetName: "Big Invite",
      competitionId: "m1",
      prCelebration: null,
      isFirstThrow: false,
    });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not throw if notification create fails", async () => {
    mockFindUnique.mockResolvedValue({ id: "a1", coachId: "c1", isSelfCoached: false });
    mockCreateNotification.mockRejectedValueOnce(new Error("db down"));
    await expect(
      notifyCompetitionEvent({
        athleteId: "a1",
        actorRole: "ATHLETE",
        meetName: "Big Invite",
        competitionId: "m1",
        prCelebration: { event: "SHOT_PUT", oldPR: 18.0, newPR: 18.42 },
        isFirstThrow: false,
      })
    ).resolves.toBeUndefined();
  });

  it("does not notify anyone for a self-coached athlete logging their own PR", async () => {
    mockFindUnique.mockResolvedValue({ id: "a1", coachId: "c1", isSelfCoached: true });
    await notifyCompetitionEvent({
      athleteId: "a1",
      actorRole: "ATHLETE",
      meetName: "Solo Meet",
      competitionId: "m1",
      prCelebration: { event: "SHOT_PUT", oldPR: 18.0, newPR: 18.42 },
      isFirstThrow: false,
    });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});
