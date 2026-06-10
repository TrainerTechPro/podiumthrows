import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: vi.fn() },
    analysisJob: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { checkAnalysisAllowance, monthStartUtc } from "../gating";

const athlete = (plan: string) => ({ coachId: "c1", coach: { plan } });

beforeEach(() => vi.clearAllMocks());

describe("checkAnalysisAllowance (PRD §8)", () => {
  it("FREE: 3/month, watermark, no calibrated velocity", async () => {
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(athlete("FREE"));
    (prisma.analysisJob.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    const a = (await checkAnalysisAllowance("a1"))!;
    expect(a).toMatchObject({
      allowed: true,
      plan: "FREE",
      used: 2,
      quota: 3,
      remaining: 1,
      watermark: true,
      calibratedVelocity: false,
    });
  });

  it("FREE at quota: blocked", async () => {
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(athlete("FREE"));
    (prisma.analysisJob.count as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    const a = (await checkAnalysisAllowance("a1"))!;
    expect(a.allowed).toBe(false);
    expect(a.remaining).toBe(0);
  });

  it("PRO: 50/month, no watermark, no calibrated velocity", async () => {
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(athlete("PRO"));
    (prisma.analysisJob.count as ReturnType<typeof vi.fn>).mockResolvedValue(49);
    const a = (await checkAnalysisAllowance("a1"))!;
    expect(a).toMatchObject({ allowed: true, quota: 50, remaining: 1, watermark: false, calibratedVelocity: false });
  });

  it("ELITE: unlimited + calibrated velocity", async () => {
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(athlete("ELITE"));
    (prisma.analysisJob.count as ReturnType<typeof vi.fn>).mockResolvedValue(5000);
    const a = (await checkAnalysisAllowance("a1"))!;
    expect(a).toMatchObject({ allowed: true, quota: null, remaining: null, calibratedVelocity: true });
  });

  it("counts only this month's non-FAILED jobs for the coach's whole roster", async () => {
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(athlete("PRO"));
    (prisma.analysisJob.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const now = new Date("2026-06-09T12:00:00Z");
    await checkAnalysisAllowance("a1", now);
    expect(prisma.analysisJob.count).toHaveBeenCalledWith({
      where: {
        athlete: { coachId: "c1" },
        createdAt: { gte: new Date("2026-06-01T00:00:00Z") },
        status: { not: "FAILED" },
      },
    });
  });

  it("returns null for unknown athlete", async () => {
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await checkAnalysisAllowance("nope")).toBeNull();
  });
});

describe("monthStartUtc", () => {
  it("is the UTC month boundary", () => {
    expect(monthStartUtc(new Date("2026-06-30T23:59:59Z")).toISOString()).toBe(
      "2026-06-01T00:00:00.000Z"
    );
  });
});
