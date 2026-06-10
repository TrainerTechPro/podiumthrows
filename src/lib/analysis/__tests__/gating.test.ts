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

  it("pools the quota per coach: two athletes share one pool", async () => {
    // Free coach c1 with athletes a1 and a2. All 3 analyses this month were
    // a1's. Per-coach semantics: a2 is blocked too. Per-athlete semantics
    // (the bug this pins against) would hand a2 a fresh quota of 3.
    const roster: Record<string, { coachId: string; coach: { plan: string } }> = {
      a1: { coachId: "c1", coach: { plan: "FREE" } },
      a2: { coachId: "c1", coach: { plan: "FREE" } },
    };
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: { where: { id: string } }) => roster[where.id] ?? null
    );

    const jobs = [
      { athleteId: "a1", coachId: "c1" },
      { athleteId: "a1", coachId: "c1" },
      { athleteId: "a1", coachId: "c1" },
    ];
    // Fake-DB count: honors whichever filter the implementation sends, so a
    // per-athlete query (athleteId) would see 0 jobs for a2 and wrongly allow.
    (prisma.analysisJob.count as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ where }: { where: { athlete?: { coachId: string }; athleteId?: string } }) =>
        jobs.filter(
          (j) =>
            (where.athlete?.coachId == null || j.coachId === where.athlete.coachId) &&
            (where.athleteId == null || j.athleteId === where.athleteId)
        ).length
    );

    const forA1 = (await checkAnalysisAllowance("a1"))!;
    const forA2 = (await checkAnalysisAllowance("a2"))!;
    expect(forA1.allowed).toBe(false);
    expect(forA2.allowed).toBe(false);
    expect(forA2.used).toBe(3);
    expect(forA2.remaining).toBe(0);
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
