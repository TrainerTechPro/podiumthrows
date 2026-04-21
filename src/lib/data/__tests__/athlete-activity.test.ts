import { describe, it, expect, vi, beforeEach } from "vitest";

const mockThrowsAssignmentFindMany = vi.fn();
const mockTrainingSessionFindMany = vi.fn();
const mockAthleteThrowsSessionFindMany = vi.fn();
const mockProgramSessionFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsAssignment: { findMany: (...a: unknown[]) => mockThrowsAssignmentFindMany(...a) },
    trainingSession: { findMany: (...a: unknown[]) => mockTrainingSessionFindMany(...a) },
    athleteThrowsSession: {
      findMany: (...a: unknown[]) => mockAthleteThrowsSessionFindMany(...a),
    },
    programSession: { findMany: (...a: unknown[]) => mockProgramSessionFindMany(...a) },
  },
}));

import {
  normalizeThrowsAssignment,
  normalizeTrainingSession,
  normalizeSelfLogged,
  normalizeProgramSession,
  loadSourceRows,
  type ThrowsAssignmentRow,
  type TrainingSessionRow,
  type SelfLoggedRow,
  type ProgramSessionRow,
} from "../athlete-activity";

const baseAssignmentRow: ThrowsAssignmentRow = {
  id: "asgn-1",
  athleteId: "athlete-1",
  assignedDate: "2026-04-20",
  status: "ASSIGNED",
  startedAt: null,
  completedAt: null,
  rpe: null,
  selfFeeling: null,
  feedbackNotes: null,
  session: { event: "SHOT_PUT", name: "Heavy Day", tags: null },
  throwLogs: [],
};

const baseTrainingRow: TrainingSessionRow = {
  id: "train-1",
  athleteId: "athlete-1",
  scheduledDate: new Date("2026-04-20T08:00:00.000Z"),
  completedDate: null,
  status: "SCHEDULED",
  rpe: null,
  coachNotes: null,
  plan: { name: "Spring Block 1" },
  logs: [],
  throwLogs: [],
};

const baseSelfRow: SelfLoggedRow = {
  id: "self-1",
  athleteId: "athlete-1",
  event: "DISCUS",
  date: "2026-04-20",
  focus: "Technique",
  sessionRpe: null,
  sessionFeeling: null,
  createdAt: new Date("2026-04-20T17:30:00.000Z"),
  drillLogs: [],
};

const baseProgramRow: ProgramSessionRow = {
  id: "prog-1",
  status: "SCHEDULED",
  scheduledDate: "2026-04-20",
  weekNumber: 2,
  dayOfWeek: 3,
  focusLabel: "High Vol Technical",
  sessionType: "THROWS_ONLY",
  completedAt: null,
  rpe: null,
  selfFeeling: null,
  bestMark: null,
  actualThrows: null,
  program: {
    event: "HAMMER",
    startDate: "2026-04-13",
    selfProgramConfig: { id: "cfg-1" },
  },
};

describe("normalizeThrowsAssignment", () => {
  it("maps ASSIGNED → planned with assignment detail href", () => {
    const out = normalizeThrowsAssignment(baseAssignmentRow);
    expect(out.status).toBe("planned");
    expect(out.href).toBe("/athlete/sessions/assignment/asgn-1");
    expect(out.source).toBe("assigned-throws");
    expect(out.assignedBy).toBe("coach");
    expect(out.kind).toBe("throws");
    expect(out.event).toBe("SHOT_PUT");
  });

  it("maps NOTIFIED → planned (same href as ASSIGNED)", () => {
    const out = normalizeThrowsAssignment({ ...baseAssignmentRow, status: "NOTIFIED" });
    expect(out.status).toBe("planned");
    expect(out.href).toBe("/athlete/sessions/assignment/asgn-1");
  });

  it("maps IN_PROGRESS → active with live href", () => {
    const out = normalizeThrowsAssignment({ ...baseAssignmentRow, status: "IN_PROGRESS" });
    expect(out.status).toBe("active");
    expect(out.href).toBe("/athlete/throws/live/asgn-1");
  });

  it("maps COMPLETED / PARTIAL / SKIPPED → read-only href", () => {
    for (const raw of ["COMPLETED", "PARTIAL", "SKIPPED"] as const) {
      const out = normalizeThrowsAssignment({ ...baseAssignmentRow, status: raw });
      expect(out.href).toBe("/athlete/throws/session/asgn-1");
    }
  });

  it("parses YYYY-MM-DD assignedDate to noon UTC", () => {
    const out = normalizeThrowsAssignment(baseAssignmentRow);
    expect(out.scheduledAt?.toISOString()).toBe("2026-04-20T12:00:00.000Z");
  });

  it("computes bestMarkM from throwLogs, ignoring null/zero distances", () => {
    const out = normalizeThrowsAssignment({
      ...baseAssignmentRow,
      status: "COMPLETED",
      throwLogs: [{ distance: 18.42 }, { distance: null }, { distance: 0 }, { distance: 18.96 }],
    });
    expect(out.metrics.throwCount).toBe(4);
    expect(out.metrics.bestMarkM).toBe(18.96);
  });

  it("surfaces coach feedback when feedbackNotes present", () => {
    const out = normalizeThrowsAssignment({
      ...baseAssignmentRow,
      feedbackNotes: "Work on hip drive",
    });
    expect(out.coachFeedback).toEqual({ summary: "Work on hip drive", hasUnread: false });
  });
});

describe("normalizeTrainingSession", () => {
  it("maps SCHEDULED → planned with generic detail href", () => {
    const out = normalizeTrainingSession(baseTrainingRow);
    expect(out.status).toBe("planned");
    expect(out.href).toBe("/athlete/sessions/train-1");
    expect(out.source).toBe("assigned-training");
  });

  it("derives kind=throws when only throwLogs exist", () => {
    const out = normalizeTrainingSession({
      ...baseTrainingRow,
      status: "COMPLETED",
      throwLogs: [{ id: "t1", event: "JAVELIN", distance: 62.3 }],
    });
    expect(out.kind).toBe("throws");
    expect(out.event).toBe("JAVELIN");
  });

  it("derives kind=strength when only lifts exist", () => {
    const out = normalizeTrainingSession({
      ...baseTrainingRow,
      status: "COMPLETED",
      logs: [{ id: "l1", distance: null, weight: 140, sets: 3, reps: 5 }],
    });
    expect(out.kind).toBe("strength");
    expect(out.metrics.totalVolumeKg).toBe(140 * 3 * 5);
  });

  it("derives kind=mixed when both throws and lifts exist", () => {
    const out = normalizeTrainingSession({
      ...baseTrainingRow,
      status: "COMPLETED",
      logs: [{ id: "l1", distance: null, weight: 100, sets: 3, reps: 3 }],
      throwLogs: [{ id: "t1", event: "SHOT_PUT", distance: 15.2 }],
    });
    expect(out.kind).toBe("mixed");
  });

  it("passes through DateTime scheduledDate unchanged", () => {
    const out = normalizeTrainingSession(baseTrainingRow);
    expect(out.scheduledAt).toEqual(new Date("2026-04-20T08:00:00.000Z"));
  });
});

describe("normalizeSelfLogged", () => {
  it("derives status=active when sessionRpe is null", () => {
    const out = normalizeSelfLogged(baseSelfRow);
    expect(out.status).toBe("active");
    expect(out.completedAt).toBeNull();
  });

  it("derives status=completed when sessionRpe is set", () => {
    const out = normalizeSelfLogged({ ...baseSelfRow, sessionRpe: 7 });
    expect(out.status).toBe("completed");
    expect(out.completedAt).toEqual(new Date("2026-04-20T17:30:00.000Z"));
    expect(out.metrics.rpe).toBe(7);
  });

  it("coerces event string to EventType; leaves unknown values null", () => {
    expect(normalizeSelfLogged(baseSelfRow).event).toBe("DISCUS");
    expect(normalizeSelfLogged({ ...baseSelfRow, event: "WEIRD_EVENT" }).event).toBeNull();
  });

  it("aggregates throwCount + bestMarkM across drillLogs", () => {
    const out = normalizeSelfLogged({
      ...baseSelfRow,
      sessionRpe: 6,
      drillLogs: [
        { id: "d1", throwCount: 8, bestMark: 50.1, implementWeight: 7.26 },
        { id: "d2", throwCount: 12, bestMark: 52.8, implementWeight: 7.26 },
        { id: "d3", throwCount: 4, bestMark: null, implementWeight: 6.0 },
      ],
    });
    expect(out.metrics.throwCount).toBe(24);
    expect(out.metrics.bestMarkM).toBe(52.8);
  });

  it("always emits assignedBy=self with log-session href", () => {
    const out = normalizeSelfLogged(baseSelfRow);
    expect(out.assignedBy).toBe("self");
    expect(out.href).toBe("/athlete/log-session");
  });
});

describe("normalizeProgramSession", () => {
  it("maps PLANNED + SCHEDULED → planned", () => {
    expect(normalizeProgramSession({ ...baseProgramRow, status: "PLANNED" }).status).toBe(
      "planned"
    );
    expect(normalizeProgramSession({ ...baseProgramRow, status: "SCHEDULED" }).status).toBe(
      "planned"
    );
  });

  it("uses explicit scheduledDate when present", () => {
    const out = normalizeProgramSession(baseProgramRow);
    expect(out.scheduledAt?.toISOString()).toBe("2026-04-20T12:00:00.000Z");
  });

  it("falls back to program.startDate + weekNumber + dayOfWeek when scheduledDate is null", () => {
    // startDate = 2026-04-13 (Monday), week 2 (+7 days), day 3 (+2 days) = 2026-04-22
    const out = normalizeProgramSession({
      ...baseProgramRow,
      scheduledDate: null,
      weekNumber: 2,
      dayOfWeek: 3,
    });
    expect(out.scheduledAt?.toISOString().slice(0, 10)).toBe("2026-04-22");
  });

  it("returns scheduledAt=null when both scheduledDate and startDate are null", () => {
    const out = normalizeProgramSession({
      ...baseProgramRow,
      scheduledDate: null,
      program: { ...baseProgramRow.program, startDate: null },
    });
    expect(out.scheduledAt).toBeNull();
  });

  it("routes to /athlete/self-program/{configId}/session/{id} when self-program config exists", () => {
    const out = normalizeProgramSession(baseProgramRow);
    expect(out.href).toBe("/athlete/self-program/cfg-1/session/prog-1");
  });

  it("falls back to /athlete/sessions/{id} when no self-program config", () => {
    const out = normalizeProgramSession({
      ...baseProgramRow,
      program: { ...baseProgramRow.program, selfProgramConfig: null },
    });
    expect(out.href).toBe("/athlete/sessions/prog-1");
  });

  it("maps sessionType to kind (THROWS_ONLY=throws, LIFT_ONLY=strength, THROWS_LIFT=mixed)", () => {
    expect(normalizeProgramSession({ ...baseProgramRow, sessionType: "THROWS_ONLY" }).kind).toBe(
      "throws"
    );
    expect(normalizeProgramSession({ ...baseProgramRow, sessionType: "LIFT_ONLY" }).kind).toBe(
      "strength"
    );
    expect(normalizeProgramSession({ ...baseProgramRow, sessionType: "THROWS_LIFT" }).kind).toBe(
      "mixed"
    );
  });
});

// ── loadSourceRows — integration test with mocked prisma ───────────────────

describe("loadSourceRows — orchestration + dedupe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThrowsAssignmentFindMany.mockResolvedValue([]);
    mockTrainingSessionFindMany.mockResolvedValue([]);
    mockAthleteThrowsSessionFindMany.mockResolvedValue([]);
    mockProgramSessionFindMany.mockResolvedValue([]);
  });

  it("emits items from all 4 sources and sorts by scheduledAt desc", async () => {
    mockThrowsAssignmentFindMany.mockResolvedValue([
      { ...baseAssignmentRow, id: "a1", assignedDate: "2026-04-18" },
    ]);
    mockTrainingSessionFindMany.mockResolvedValue([
      {
        ...baseTrainingRow,
        id: "t1",
        scheduledDate: new Date("2026-04-20T08:00:00.000Z"),
      },
    ]);
    mockAthleteThrowsSessionFindMany.mockResolvedValue([
      { ...baseSelfRow, id: "s1", date: "2026-04-19" },
    ]);
    mockProgramSessionFindMany.mockResolvedValue([
      { ...baseProgramRow, id: "p1", scheduledDate: "2026-04-17" },
    ]);

    const out = await loadSourceRows("athlete-1");

    expect(out.map((i) => i.id)).toEqual(["t1", "s1", "a1", "p1"]);
  });

  it("drops the ProgramSession when a ThrowsAssignment shadows it via selfProgram tag", async () => {
    mockThrowsAssignmentFindMany.mockResolvedValue([
      {
        ...baseAssignmentRow,
        id: "asgn-shadowing",
        session: {
          event: "HAMMER",
          name: "Self-Program Session",
          tags: JSON.stringify(["selfProgram:prog-shadowed", "technical"]),
        },
      },
    ]);
    mockProgramSessionFindMany.mockResolvedValue([
      { ...baseProgramRow, id: "prog-shadowed" },
      { ...baseProgramRow, id: "prog-visible" },
    ]);

    const out = await loadSourceRows("athlete-1");
    const ids = out.map((i) => i.id);

    expect(ids).toContain("asgn-shadowing");
    expect(ids).toContain("prog-visible");
    expect(ids).not.toContain("prog-shadowed");
  });

  it("tolerates malformed tags JSON (treats as no shadow)", async () => {
    mockThrowsAssignmentFindMany.mockResolvedValue([
      {
        ...baseAssignmentRow,
        id: "a1",
        session: { event: "SHOT_PUT", name: "x", tags: "not-json{{" },
      },
    ]);
    mockProgramSessionFindMany.mockResolvedValue([{ ...baseProgramRow, id: "p1" }]);

    const out = await loadSourceRows("athlete-1");
    expect(out.map((i) => i.id)).toContain("p1");
  });

  it("filters by statuses when provided", async () => {
    mockThrowsAssignmentFindMany.mockResolvedValue([
      { ...baseAssignmentRow, id: "a-planned", status: "ASSIGNED" },
      { ...baseAssignmentRow, id: "a-done", status: "COMPLETED" },
    ]);

    const out = await loadSourceRows("athlete-1", { statuses: ["completed"] });

    expect(out.map((i) => i.id)).toEqual(["a-done"]);
  });

  it("applies limit after sort", async () => {
    mockThrowsAssignmentFindMany.mockResolvedValue([
      { ...baseAssignmentRow, id: "a1", assignedDate: "2026-04-15" },
      { ...baseAssignmentRow, id: "a2", assignedDate: "2026-04-18" },
      { ...baseAssignmentRow, id: "a3", assignedDate: "2026-04-20" },
    ]);

    const out = await loadSourceRows("athlete-1", { limit: 2 });

    expect(out.map((i) => i.id)).toEqual(["a3", "a2"]);
  });

  it("skips program sessions with no resolvable date", async () => {
    mockProgramSessionFindMany.mockResolvedValue([
      {
        ...baseProgramRow,
        id: "p-orphan",
        scheduledDate: null,
        program: { ...baseProgramRow.program, startDate: null },
      },
    ]);

    const out = await loadSourceRows("athlete-1");
    expect(out.map((i) => i.id)).not.toContain("p-orphan");
  });
});
