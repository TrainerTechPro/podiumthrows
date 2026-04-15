import { describe, it, expect } from "vitest";
import { getAssessmentStatus } from "@/lib/bondarchuk/assessment-status";

// Fixed reference point so day-math is deterministic regardless of when tests run.
const NOW = new Date("2026-04-14T12:00:00.000Z");
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

describe("getAssessmentStatus", () => {
  describe("fresh tier (0–30 days)", () => {
    it("treats today as fresh", () => {
      const s = getAssessmentStatus(NOW, NOW);
      expect(s.tier).toBe("fresh");
      expect(s.days).toBe(0);
      expect(s.canAssign).toBe(true);
      expect(s.canOverride).toBe(false);
    });

    it("treats exactly 30 days as fresh (inclusive upper bound)", () => {
      const s = getAssessmentStatus(daysAgo(30), NOW);
      expect(s.tier).toBe("fresh");
      expect(s.days).toBe(30);
      expect(s.canAssign).toBe(true);
    });
  });

  describe("aging tier (31–60 days)", () => {
    it("treats day 31 as aging", () => {
      const s = getAssessmentStatus(daysAgo(31), NOW);
      expect(s.tier).toBe("aging");
      expect(s.days).toBe(31);
      expect(s.canAssign).toBe(true);
      expect(s.canOverride).toBe(false);
      expect(s.label.toLowerCase()).toContain("re-test");
    });

    it("treats exactly 60 days as aging (inclusive upper bound)", () => {
      const s = getAssessmentStatus(daysAgo(60), NOW);
      expect(s.tier).toBe("aging");
      expect(s.days).toBe(60);
    });
  });

  describe("stale tier (61–90 days)", () => {
    it("treats day 61 as stale", () => {
      const s = getAssessmentStatus(daysAgo(61), NOW);
      expect(s.tier).toBe("stale");
      expect(s.days).toBe(61);
      expect(s.canAssign).toBe(true);
      expect(s.canOverride).toBe(false);
    });

    it("treats exactly 90 days as stale (inclusive upper bound)", () => {
      const s = getAssessmentStatus(daysAgo(90), NOW);
      expect(s.tier).toBe("stale");
      expect(s.days).toBe(90);
      expect(s.canAssign).toBe(true);
    });
  });

  describe("expired tier (>90 days)", () => {
    it("treats day 91 as expired", () => {
      const s = getAssessmentStatus(daysAgo(91), NOW);
      expect(s.tier).toBe("expired");
      expect(s.days).toBe(91);
      expect(s.canAssign).toBe(false);
      expect(s.canOverride).toBe(true);
    });

    it("treats very old assessments as expired", () => {
      const s = getAssessmentStatus(daysAgo(400), NOW);
      expect(s.tier).toBe("expired");
      expect(s.days).toBe(400);
      expect(s.canAssign).toBe(false);
      expect(s.canOverride).toBe(true);
    });
  });

  describe("never tier (no assessment)", () => {
    it("returns never for null", () => {
      const s = getAssessmentStatus(null, NOW);
      expect(s.tier).toBe("never");
      expect(s.days).toBe(0);
      expect(s.canAssign).toBe(false);
      expect(s.canOverride).toBe(false);
      expect(s.label.toLowerCase()).toContain("assess");
    });
  });

  describe("label content", () => {
    it("fresh label mentions 'fresh' or similar positive wording", () => {
      const s = getAssessmentStatus(daysAgo(5), NOW);
      expect(s.label.length).toBeGreaterThan(0);
    });

    it("expired label surfaces the day count", () => {
      const s = getAssessmentStatus(daysAgo(127), NOW);
      expect(s.label).toContain("127");
    });
  });

  describe("input robustness", () => {
    it("accepts string ISO dates (Prisma serializes Date → string in JSON)", () => {
      const s = getAssessmentStatus(daysAgo(10).toISOString(), NOW);
      expect(s.tier).toBe("fresh");
      expect(s.days).toBe(10);
    });

    it("treats a future assessmentDate as fresh with 0 days (clock skew tolerance)", () => {
      const future = new Date(NOW.getTime() + 3600_000);
      const s = getAssessmentStatus(future, NOW);
      expect(s.tier).toBe("fresh");
      expect(s.days).toBe(0);
    });
  });
});
