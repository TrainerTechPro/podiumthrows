// src/lib/__tests__/comment-access.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the module under test.
vi.mock("@/lib/prisma", () => ({
  default: {
    coachProfile: { findUnique: vi.fn() },
    athleteProfile: { findUnique: vi.fn() },
    throwLog: { findUnique: vi.fn() },
    practiceAttempt: { findUnique: vi.fn() },
    trainingSession: { findUnique: vi.fn() },
    throwsAssignment: { findUnique: vi.fn() },
    athleteDrillLog: { findUnique: vi.fn() },
    videoAnalysis: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import {
  commentTargetPair,
  isTargetField,
  TARGET_FIELDS,
  verifyCommentAccess,
} from "../comments/access";

const m = prisma as unknown as {
  coachProfile: { findUnique: ReturnType<typeof vi.fn> };
  athleteProfile: { findUnique: ReturnType<typeof vi.fn> };
  throwLog: { findUnique: ReturnType<typeof vi.fn> };
  practiceAttempt: { findUnique: ReturnType<typeof vi.fn> };
  trainingSession: { findUnique: ReturnType<typeof vi.fn> };
  throwsAssignment: { findUnique: ReturnType<typeof vi.fn> };
  athleteDrillLog: { findUnique: ReturnType<typeof vi.fn> };
  videoAnalysis: { findUnique: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TARGET_FIELDS + isTargetField", () => {
  it("enumerates all six polymorphic target columns", () => {
    expect(TARGET_FIELDS).toEqual([
      "throwLogId",
      "practiceAttemptId",
      "trainingSessionId",
      "throwsAssignmentId",
      "athleteDrillLogId",
      "videoAnalysisId",
    ]);
  });

  it("accepts every valid target field name", () => {
    for (const f of TARGET_FIELDS) expect(isTargetField(f)).toBe(true);
  });

  it("rejects unknown field names and non-strings", () => {
    expect(isTargetField("unknownId")).toBe(false);
    expect(isTargetField("")).toBe(false);
    expect(isTargetField(null)).toBe(false);
    expect(isTargetField(42)).toBe(false);
  });
});

describe("commentTargetPair", () => {
  it("returns the single non-null (field, id) pair", () => {
    const pair = commentTargetPair({
      throwLogId: null,
      practiceAttemptId: null,
      trainingSessionId: "ts_abc",
      throwsAssignmentId: null,
      athleteDrillLogId: null,
      videoAnalysisId: null,
    });
    expect(pair).toEqual({ field: "trainingSessionId", id: "ts_abc" });
  });

  it("returns null when no target is set", () => {
    const pair = commentTargetPair({
      throwLogId: null,
      practiceAttemptId: null,
      trainingSessionId: null,
      throwsAssignmentId: null,
      athleteDrillLogId: null,
      videoAnalysisId: null,
    });
    expect(pair).toBeNull();
  });

  it("returns the first non-null field if multiple are set", () => {
    const pair = commentTargetPair({
      throwLogId: "tl_1",
      practiceAttemptId: "pa_1",
      trainingSessionId: null,
      throwsAssignmentId: null,
      athleteDrillLogId: null,
      videoAnalysisId: null,
    });
    expect(pair?.field).toBe("throwLogId");
  });
});

describe("verifyCommentAccess — COACH role", () => {
  it("grants access when coach owns the athlete on a throwLog target", async () => {
    m.coachProfile.findUnique.mockResolvedValue({ id: "coach_1" });
    m.throwLog.findUnique.mockResolvedValue({ athlete: { coachId: "coach_1" } });

    const ok = await verifyCommentAccess("user_coach_1", "COACH", "throwLogId", "tl_1");
    expect(ok).toBe(true);
  });

  it("denies access when the throw belongs to a different coach", async () => {
    m.coachProfile.findUnique.mockResolvedValue({ id: "coach_1" });
    m.throwLog.findUnique.mockResolvedValue({ athlete: { coachId: "coach_other" } });

    const ok = await verifyCommentAccess("user_coach_1", "COACH", "throwLogId", "tl_1");
    expect(ok).toBe(false);
  });

  it("denies when the target row is missing", async () => {
    m.coachProfile.findUnique.mockResolvedValue({ id: "coach_1" });
    m.throwLog.findUnique.mockResolvedValue(null);

    const ok = await verifyCommentAccess("user_coach_1", "COACH", "throwLogId", "nope");
    expect(ok).toBe(false);
  });

  it("denies when the coach has no profile", async () => {
    m.coachProfile.findUnique.mockResolvedValue(null);

    const ok = await verifyCommentAccess("user_coach_1", "COACH", "throwLogId", "tl_1");
    expect(ok).toBe(false);
  });

  it("grants on athleteDrillLogId when the nested session's athlete belongs to the coach", async () => {
    m.coachProfile.findUnique.mockResolvedValue({ id: "coach_1" });
    m.athleteDrillLog.findUnique.mockResolvedValue({
      session: { athlete: { coachId: "coach_1" } },
    });

    const ok = await verifyCommentAccess("user_coach_1", "COACH", "athleteDrillLogId", "dl_1");
    expect(ok).toBe(true);
  });

  it("grants on videoAnalysisId when the coach owns the analysis directly", async () => {
    m.coachProfile.findUnique.mockResolvedValue({ id: "coach_1" });
    m.videoAnalysis.findUnique.mockResolvedValue({ coachId: "coach_1" });

    const ok = await verifyCommentAccess("user_coach_1", "COACH", "videoAnalysisId", "va_1");
    expect(ok).toBe(true);
  });

  it("grants on practiceAttemptId when the session belongs to the coach", async () => {
    m.coachProfile.findUnique.mockResolvedValue({ id: "coach_1" });
    m.practiceAttempt.findUnique.mockResolvedValue({ session: { coachId: "coach_1" } });

    const ok = await verifyCommentAccess("user_coach_1", "COACH", "practiceAttemptId", "pa_1");
    expect(ok).toBe(true);
  });

  it("grants on trainingSessionId through athlete.coachId", async () => {
    m.coachProfile.findUnique.mockResolvedValue({ id: "coach_1" });
    m.trainingSession.findUnique.mockResolvedValue({ athlete: { coachId: "coach_1" } });

    const ok = await verifyCommentAccess("user_coach_1", "COACH", "trainingSessionId", "ts_1");
    expect(ok).toBe(true);
  });

  it("grants on throwsAssignmentId through session.coachId", async () => {
    m.coachProfile.findUnique.mockResolvedValue({ id: "coach_1" });
    m.throwsAssignment.findUnique.mockResolvedValue({ session: { coachId: "coach_1" } });

    const ok = await verifyCommentAccess("user_coach_1", "COACH", "throwsAssignmentId", "ta_1");
    expect(ok).toBe(true);
  });
});

describe("verifyCommentAccess — ATHLETE role", () => {
  it("grants when the athlete owns the target (throwLogId)", async () => {
    m.athleteProfile.findUnique.mockResolvedValue({ id: "athlete_1" });
    m.throwLog.findUnique.mockResolvedValue({ athleteId: "athlete_1" });

    const ok = await verifyCommentAccess("user_ath_1", "ATHLETE", "throwLogId", "tl_1");
    expect(ok).toBe(true);
  });

  it("denies when the target belongs to a different athlete", async () => {
    m.athleteProfile.findUnique.mockResolvedValue({ id: "athlete_1" });
    m.throwLog.findUnique.mockResolvedValue({ athleteId: "athlete_other" });

    const ok = await verifyCommentAccess("user_ath_1", "ATHLETE", "throwLogId", "tl_1");
    expect(ok).toBe(false);
  });

  it("denies on videoAnalysisId when the analysis belongs to a different athlete", async () => {
    m.athleteProfile.findUnique.mockResolvedValue({ id: "athlete_1" });
    m.videoAnalysis.findUnique.mockResolvedValue({ athleteId: "athlete_other" });

    const ok = await verifyCommentAccess("user_ath_1", "ATHLETE", "videoAnalysisId", "va_1");
    expect(ok).toBe(false);
  });

  it("grants on athleteDrillLogId through session.athleteId", async () => {
    m.athleteProfile.findUnique.mockResolvedValue({ id: "athlete_1" });
    m.athleteDrillLog.findUnique.mockResolvedValue({
      session: { athleteId: "athlete_1" },
    });

    const ok = await verifyCommentAccess("user_ath_1", "ATHLETE", "athleteDrillLogId", "dl_1");
    expect(ok).toBe(true);
  });
});

describe("verifyCommentAccess — invalid roles", () => {
  it("returns false for an unknown role", async () => {
    const ok = await verifyCommentAccess("user_x", "SPECTATOR", "throwLogId", "tl_1");
    expect(ok).toBe(false);
  });
});
