import { describe, it, expect } from "vitest";
import { mergeSessions, type SessionInput } from "../coexistence";

// ── Test Data Factory ─────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionInput> = {}): SessionInput {
  return {
    id: "sess-" + Math.random().toString(36).slice(2, 8),
    scheduledDate: "2026-04-01",
    sessionType: "THROWS_LIFT",
    dayOfWeek: 1,
    totalThrowsTarget: 30,
    status: "PLANNED",
    ...overrides,
  };
}

describe("mergeSessions", () => {
  // ── No Conflict ───────────────────────────────────────────────────

  describe("no conflict — sessions on different days", () => {
    it("returns all sessions with none hidden", () => {
      const coachSessions: SessionInput[] = [
        makeSession({ id: "c1", scheduledDate: "2026-04-01", dayOfWeek: 1, totalThrowsTarget: 30 }),
        makeSession({ id: "c2", scheduledDate: "2026-04-03", dayOfWeek: 3, totalThrowsTarget: 25 }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({ id: "s1", scheduledDate: "2026-04-02", dayOfWeek: 2, totalThrowsTarget: 20 }),
        makeSession({ id: "s2", scheduledDate: "2026-04-04", dayOfWeek: 4, totalThrowsTarget: 20 }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      expect(result.sessions).toHaveLength(4);
      expect(result.sessions.every((s) => s.hidden === false)).toBe(true);

      // Coach sessions are primary
      const coachMerged = result.sessions.filter((s) => s.source === "COACH_PRESCRIBED");
      expect(coachMerged).toHaveLength(2);
      expect(coachMerged.every((s) => s.isPrimary === true)).toBe(true);

      // Self sessions are also primary (no conflict)
      const selfMerged = result.sessions.filter((s) => s.source === "ATHLETE_SELF_GENERATED");
      expect(selfMerged).toHaveLength(2);
      expect(selfMerged.every((s) => s.isPrimary === true)).toBe(true);
    });
  });

  // ── Throws Conflict Same Day ──────────────────────────────────────

  describe("throws conflict on the same day", () => {
    it("hides self throwing session when coach also has throws on that day", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_LIFT",
          totalThrowsTarget: 30,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 25,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      const coachMerged = result.sessions.find((s) => s.session.id === "c1");
      const selfMerged = result.sessions.find((s) => s.session.id === "s1");

      expect(coachMerged!.isPrimary).toBe(true);
      expect(coachMerged!.hidden).toBe(false);
      expect(selfMerged!.hidden).toBe(true);
    });

    it("hides self THROWS_LIFT when coach has THROWS_ONLY on same day", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 20,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_LIFT",
          totalThrowsTarget: 30,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      const selfMerged = result.sessions.find((s) => s.session.id === "s1");
      expect(selfMerged!.hidden).toBe(true);
    });

    it("hides self THROWS_ONLY when coach has THROWS_ONLY on same day", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 20,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 15,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      const selfMerged = result.sessions.find((s) => s.session.id === "s1");
      expect(selfMerged!.hidden).toBe(true);
    });
  });

  // ── Lifting Conflict Same Day ─────────────────────────────────────

  describe("lifting conflict on the same day", () => {
    it("shows both when both have LIFT_ONLY on same day and flags volume", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "LIFT_ONLY",
          totalThrowsTarget: 0,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "LIFT_ONLY",
          totalThrowsTarget: 0,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions.every((s) => s.hidden === false)).toBe(true);
    });
  });

  // ── Mixed Conflict ────────────────────────────────────────────────

  describe("mixed conflict — coach throws, self lifts on same day", () => {
    it("shows both when coach has THROWS_LIFT and self has LIFT_ONLY (no throws overlap)", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_LIFT",
          totalThrowsTarget: 30,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "LIFT_ONLY",
          totalThrowsTarget: 0,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      expect(result.sessions).toHaveLength(2);
      const selfMerged = result.sessions.find((s) => s.session.id === "s1");
      expect(selfMerged!.hidden).toBe(false);
    });

    it("shows both when coach has THROWS_ONLY and self has LIFT_ONLY", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 25,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "LIFT_ONLY",
          totalThrowsTarget: 0,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      const selfMerged = result.sessions.find((s) => s.session.id === "s1");
      expect(selfMerged!.hidden).toBe(false);
    });
  });

  // ── Volume Aggregation ────────────────────────────────────────────

  describe("volume aggregation", () => {
    it("sums weekly throws correctly across both sources", () => {
      const coachSessions: SessionInput[] = [
        makeSession({ id: "c1", scheduledDate: "2026-04-01", totalThrowsTarget: 30 }),
        makeSession({ id: "c2", scheduledDate: "2026-04-03", totalThrowsTarget: 25 }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({ id: "s1", scheduledDate: "2026-04-02", totalThrowsTarget: 20 }),
        makeSession({ id: "s2", scheduledDate: "2026-04-04", totalThrowsTarget: 15 }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      expect(result.volume.coachThrows).toBe(55); // 30 + 25
      expect(result.volume.selfThrows).toBe(35); // 20 + 15
      expect(result.volume.totalThrows).toBe(90); // 55 + 35
    });

    it("excludes hidden sessions from self throws volume", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_LIFT",
          totalThrowsTarget: 30,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 25,
        }),
        makeSession({
          id: "s2",
          scheduledDate: "2026-04-02",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 20,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      // s1 is hidden (throws conflict), s2 is not hidden
      expect(result.volume.coachThrows).toBe(30);
      expect(result.volume.selfThrows).toBe(20); // only s2 (s1 hidden)
      expect(result.volume.totalThrows).toBe(50);
    });
  });

  // ── Volume Warning ────────────────────────────────────────────────

  describe("volume warning", () => {
    it("returns warning when combined throws exceed weekly target", () => {
      const coachSessions: SessionInput[] = [
        makeSession({ id: "c1", scheduledDate: "2026-04-01", totalThrowsTarget: 60 }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({ id: "s1", scheduledDate: "2026-04-02", totalThrowsTarget: 50 }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 100);

      expect(result.volume.warning).not.toBeNull();
      expect(result.volume.warning).toContain("110");
      expect(result.volume.warning).toContain("100");
    });

    it("returns null warning when combined throws are within target", () => {
      const coachSessions: SessionInput[] = [
        makeSession({ id: "c1", scheduledDate: "2026-04-01", totalThrowsTarget: 30 }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({ id: "s1", scheduledDate: "2026-04-02", totalThrowsTarget: 20 }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 100);

      expect(result.volume.warning).toBeNull();
    });

    it("returns null warning when combined throws exactly equal target", () => {
      const coachSessions: SessionInput[] = [
        makeSession({ id: "c1", scheduledDate: "2026-04-01", totalThrowsTarget: 50 }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({ id: "s1", scheduledDate: "2026-04-02", totalThrowsTarget: 50 }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 100);

      expect(result.volume.warning).toBeNull();
    });
  });

  // ── Empty Inputs ──────────────────────────────────────────────────

  describe("empty inputs", () => {
    it("returns all self sessions as primary when no coach sessions", () => {
      const selfSessions: SessionInput[] = [
        makeSession({ id: "s1", scheduledDate: "2026-04-01", totalThrowsTarget: 25 }),
        makeSession({ id: "s2", scheduledDate: "2026-04-02", totalThrowsTarget: 20 }),
      ];

      const result = mergeSessions([], selfSessions, 200);

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions.every((s) => s.source === "ATHLETE_SELF_GENERATED")).toBe(true);
      expect(result.sessions.every((s) => s.isPrimary === true)).toBe(true);
      expect(result.sessions.every((s) => s.hidden === false)).toBe(true);
      expect(result.volume.coachThrows).toBe(0);
      expect(result.volume.selfThrows).toBe(45);
    });

    it("returns all coach sessions as primary when no self sessions", () => {
      const coachSessions: SessionInput[] = [
        makeSession({ id: "c1", scheduledDate: "2026-04-01", totalThrowsTarget: 30 }),
        makeSession({ id: "c2", scheduledDate: "2026-04-03", totalThrowsTarget: 25 }),
      ];

      const result = mergeSessions(coachSessions, [], 200);

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions.every((s) => s.source === "COACH_PRESCRIBED")).toBe(true);
      expect(result.sessions.every((s) => s.isPrimary === true)).toBe(true);
      expect(result.sessions.every((s) => s.hidden === false)).toBe(true);
      expect(result.volume.selfThrows).toBe(0);
      expect(result.volume.coachThrows).toBe(55);
    });

    it("returns empty sessions and zero volume when both are empty", () => {
      const result = mergeSessions([], [], 200);

      expect(result.sessions).toHaveLength(0);
      expect(result.volume.coachThrows).toBe(0);
      expect(result.volume.selfThrows).toBe(0);
      expect(result.volume.totalThrows).toBe(0);
      expect(result.volume.warning).toBeNull();
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles null scheduledDate sessions", () => {
      const coachSessions: SessionInput[] = [
        makeSession({ id: "c1", scheduledDate: null, totalThrowsTarget: 30 }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({ id: "s1", scheduledDate: null, totalThrowsTarget: 20 }),
      ];

      // Both have null dates — they should not conflict with each other
      // since we can't determine overlap without a date
      const result = mergeSessions(coachSessions, selfSessions, 200);

      expect(result.sessions).toHaveLength(2);
    });

    it("handles multiple sessions on the same day from the same source", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 20,
        }),
        makeSession({
          id: "c2",
          scheduledDate: "2026-04-01",
          sessionType: "LIFT_ONLY",
          totalThrowsTarget: 0,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 15,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      // Coach has throws on this day, so self throws should be hidden
      const selfMerged = result.sessions.find((s) => s.session.id === "s1");
      expect(selfMerged!.hidden).toBe(true);
    });

    it("handles COMPETITION_SIM as a throws session type for conflict detection", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "COMPETITION_SIM",
          totalThrowsTarget: 20,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_ONLY",
          totalThrowsTarget: 15,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      // COMPETITION_SIM involves throws, so self throws should be hidden
      const selfMerged = result.sessions.find((s) => s.session.id === "s1");
      expect(selfMerged!.hidden).toBe(true);
    });

    it("does not hide RECOVERY self-sessions regardless of coach schedule", () => {
      const coachSessions: SessionInput[] = [
        makeSession({
          id: "c1",
          scheduledDate: "2026-04-01",
          sessionType: "THROWS_LIFT",
          totalThrowsTarget: 30,
        }),
      ];
      const selfSessions: SessionInput[] = [
        makeSession({
          id: "s1",
          scheduledDate: "2026-04-01",
          sessionType: "RECOVERY",
          totalThrowsTarget: 0,
        }),
      ];

      const result = mergeSessions(coachSessions, selfSessions, 200);

      const selfMerged = result.sessions.find((s) => s.session.id === "s1");
      expect(selfMerged!.hidden).toBe(false);
    });
  });
});
