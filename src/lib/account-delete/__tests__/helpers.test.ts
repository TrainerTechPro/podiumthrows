import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    athleteProfile: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import {
  canDeleteAccount,
  softDeleteUser,
  restoreUser,
  hardDeleteEligibleUsers,
  GRACE_PERIOD_MS,
} from "../helpers";

const m = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  athleteProfile: { count: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canDeleteAccount", () => {
  it("returns canDelete=false when user not found", async () => {
    m.user.findUnique.mockResolvedValue(null);
    const result = await canDeleteAccount("missing");
    expect(result.canDelete).toBe(false);
    expect(result.reason).toMatch(/not found/i);
  });

  it("blocks coach deletion when athletes exist", async () => {
    m.user.findUnique.mockResolvedValue({
      role: "COACH",
      coachProfile: { id: "c1" },
    });
    m.athleteProfile.count.mockResolvedValue(3);

    const result = await canDeleteAccount("u1");
    expect(result.canDelete).toBe(false);
    expect(result.reason).toMatch(/athletes/i);
    expect(result.athletesCount).toBe(3);
  });

  it("allows coach deletion with empty roster", async () => {
    m.user.findUnique.mockResolvedValue({
      role: "COACH",
      coachProfile: { id: "c1" },
    });
    m.athleteProfile.count.mockResolvedValue(0);

    const result = await canDeleteAccount("u1");
    expect(result.canDelete).toBe(true);
  });

  it("always allows athlete deletion", async () => {
    m.user.findUnique.mockResolvedValue({ role: "ATHLETE", coachProfile: null });
    const result = await canDeleteAccount("u2");
    expect(result.canDelete).toBe(true);
  });
});

describe("softDeleteUser", () => {
  it("writes deletedAt + deleteScheduledFor 30 days out", async () => {
    m.user.update.mockResolvedValue({});
    const before = Date.now();
    const result = await softDeleteUser("u1");
    const after = Date.now();

    expect(result.deletedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.deletedAt.getTime()).toBeLessThanOrEqual(after);
    const gracePoint = result.deleteScheduledFor.getTime() - result.deletedAt.getTime();
    expect(gracePoint).toBe(GRACE_PERIOD_MS);

    expect(m.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({
        deletedAt: expect.any(Date),
        deleteScheduledFor: expect.any(Date),
      }),
    });
  });
});

describe("restoreUser", () => {
  it("restores when within grace window", async () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60_000);
    m.user.findUnique.mockResolvedValue({
      deletedAt: new Date(),
      deleteScheduledFor: futureDate,
    });
    m.user.update.mockResolvedValue({});

    const ok = await restoreUser("u1");
    expect(ok).toBe(true);
    expect(m.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { deletedAt: null, deleteScheduledFor: null },
    });
  });

  it("refuses when user was never soft-deleted", async () => {
    m.user.findUnique.mockResolvedValue({ deletedAt: null, deleteScheduledFor: null });
    const ok = await restoreUser("u1");
    expect(ok).toBe(false);
    expect(m.user.update).not.toHaveBeenCalled();
  });

  it("refuses when grace window has lapsed", async () => {
    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60_000);
    m.user.findUnique.mockResolvedValue({
      deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60_000),
      deleteScheduledFor: pastDate,
    });
    const ok = await restoreUser("u1");
    expect(ok).toBe(false);
    expect(m.user.update).not.toHaveBeenCalled();
  });

  it("refuses when user not found", async () => {
    m.user.findUnique.mockResolvedValue(null);
    const ok = await restoreUser("u1");
    expect(ok).toBe(false);
  });
});

describe("hardDeleteEligibleUsers", () => {
  it("deletes each eligible user and returns the IDs", async () => {
    m.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }, { id: "u3" }]);
    m.user.delete.mockResolvedValue({});

    const result = await hardDeleteEligibleUsers();
    expect(result.deletedIds).toEqual(["u1", "u2", "u3"]);
    expect(m.user.delete).toHaveBeenCalledTimes(3);
  });

  it("continues past a failed delete and reports only the successes", async () => {
    m.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }, { id: "u3" }]);
    m.user.delete
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("FK violation"))
      .mockResolvedValueOnce({});

    const result = await hardDeleteEligibleUsers();
    expect(result.deletedIds).toEqual(["u1", "u3"]);
  });

  it("returns empty when nothing eligible", async () => {
    m.user.findMany.mockResolvedValue([]);
    const result = await hardDeleteEligibleUsers();
    expect(result.deletedIds).toEqual([]);
    expect(m.user.delete).not.toHaveBeenCalled();
  });
});
