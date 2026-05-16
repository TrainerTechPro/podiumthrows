import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), cache: (fn: unknown) => fn };
});

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  canActAsAthlete: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: vi.fn() },
    readinessCheckIn: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { POST } from "@/app/api/readiness/route";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/readiness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/readiness — canonical envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns canonical { success: true, data: { id, overallScore, date } }, not flat", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      role: "ATHLETE",
    });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
    });
    (prisma.readinessCheckIn.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.readinessCheckIn.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ci-1",
      overallScore: 7.5,
      date: new Date("2026-05-15"),
    });

    const res = await POST(
      makeReq({
        sleepQuality: 8,
        sleepHours: 8,
        soreness: 7,
        stressLevel: 6,
        energyMood: 7,
        hydration: "GOOD",
        injuryStatus: "NONE",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data?.id).toBe("ci-1");
    // No flat top-level fields
    expect(body.id).toBeUndefined();
    expect(body.overallScore).toBeUndefined();
  });

  it("returns 409 + canonical error envelope when a check-in already exists today", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      role: "ATHLETE",
    });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
    });
    (prisma.readinessCheckIn.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing",
    });

    const res = await POST(
      makeReq({
        sleepQuality: 8,
        sleepHours: 8,
        soreness: 7,
        stressLevel: 6,
        energyMood: 7,
        hydration: "GOOD",
        injuryStatus: "NONE",
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
  });
});
