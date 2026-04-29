import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUserFindUnique = vi.fn();
const mockCoachFindUnique = vi.fn();
const mockAthleteFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => {
  const prisma = {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    coachProfile: { findUnique: (...args: unknown[]) => mockCoachFindUnique(...args) },
    athleteProfile: { findUnique: (...args: unknown[]) => mockAthleteFindUnique(...args) },
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return { prisma, default: prisma };
});

vi.mock("@/lib/notifications/coach-preferences", () => ({
  isCoachNotificationEnabled: vi.fn().mockResolvedValue(true),
}));

import { resolveNotificationContext } from "../notifications";

describe("resolveNotificationContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ATHLETE session → resolves to athlete profile", async () => {
    mockAthleteFindUnique.mockResolvedValue({ id: "ath1" });

    const ctx = await resolveNotificationContext({ userId: "u1", role: "ATHLETE" });

    expect(ctx).toEqual({ profileId: "ath1", effectiveRole: "ATHLETE" });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockCoachFindUnique).not.toHaveBeenCalled();
  });

  it("COACH session in COACH mode → resolves to coach profile", async () => {
    mockUserFindUnique.mockResolvedValue({ activeMode: "COACH" });
    mockCoachFindUnique.mockResolvedValue({ id: "coach1" });
    mockAthleteFindUnique.mockResolvedValue(null);

    const ctx = await resolveNotificationContext({ userId: "u1", role: "COACH" });

    expect(ctx).toEqual({ profileId: "coach1", effectiveRole: "COACH" });
  });

  it("COACH session in TRAINING mode WITH athlete profile → resolves to athlete", async () => {
    mockUserFindUnique.mockResolvedValue({ activeMode: "TRAINING" });
    mockCoachFindUnique.mockResolvedValue({ id: "coach1" });
    mockAthleteFindUnique.mockResolvedValue({ id: "ath1" });

    const ctx = await resolveNotificationContext({ userId: "u1", role: "COACH" });

    expect(ctx).toEqual({ profileId: "ath1", effectiveRole: "ATHLETE" });
  });

  it("COACH session in TRAINING mode WITHOUT athlete profile → falls back to coach", async () => {
    mockUserFindUnique.mockResolvedValue({ activeMode: "TRAINING" });
    mockCoachFindUnique.mockResolvedValue({ id: "coach1" });
    mockAthleteFindUnique.mockResolvedValue(null);

    const ctx = await resolveNotificationContext({ userId: "u1", role: "COACH" });

    expect(ctx).toEqual({ profileId: "coach1", effectiveRole: "COACH" });
  });

  it("ATHLETE session with no athlete profile → returns null", async () => {
    mockAthleteFindUnique.mockResolvedValue(null);

    const ctx = await resolveNotificationContext({ userId: "u1", role: "ATHLETE" });

    expect(ctx).toBeNull();
  });

  it("COACH session with no coach profile and no training mode → returns null", async () => {
    mockUserFindUnique.mockResolvedValue({ activeMode: "COACH" });
    mockCoachFindUnique.mockResolvedValue(null);
    mockAthleteFindUnique.mockResolvedValue(null);

    const ctx = await resolveNotificationContext({ userId: "u1", role: "COACH" });

    expect(ctx).toBeNull();
  });
});
