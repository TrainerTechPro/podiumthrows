import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), cache: (fn: unknown) => fn };
});

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: vi.fn() },
    throwLog: { findMany: vi.fn() },
    trainingSession: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { POST } from "@/app/api/athlete/sessions/check-stale/route";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

describe("POST /api/athlete/sessions/check-stale — canonical envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns canonical { success: true, data: { staleSession: null } } when nothing is stale", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      role: "ATHLETE",
    });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
    });
    (prisma.throwLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ staleSession: null });
    // No flat top-level `staleSession`
    expect(body.staleSession).toBeUndefined();
  });

  it("returns 401 + canonical error envelope when unauthenticated", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
  });
});
