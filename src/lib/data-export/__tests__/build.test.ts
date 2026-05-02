import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
    coachProfile: { findUnique: vi.fn() },
    athleteProfile: { findUnique: vi.fn() },
    betaFeedback: { findMany: vi.fn() },
    trainingProgram: { findMany: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { buildExportForUser, buildCoachExport, buildAthleteExport } from "../build";
import { EXPORT_SCHEMA_VERSION } from "../types";

const m = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  coachProfile: { findUnique: ReturnType<typeof vi.fn> };
  athleteProfile: { findUnique: ReturnType<typeof vi.fn> };
  betaFeedback: { findMany: ReturnType<typeof vi.fn> };
  trainingProgram: { findMany: ReturnType<typeof vi.fn> };
};

const userRow = (role: "COACH" | "ATHLETE") => ({
  id: "u1",
  email: "test@example.com",
  passwordHash: "$2b$super-secret",
  role,
  isAdmin: false,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildExportForUser", () => {
  it("dispatches to coach builder when role=COACH", async () => {
    m.user.findUnique.mockResolvedValue({ id: "u1", role: "COACH" });
    m.coachProfile.findUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      user: userRow("COACH"),
      invitations: [],
      drills: [],
      coachNotes: [],
      voiceNotes: [],
      questionnaires: [],
      coachPRs: [],
      coachTyping: null,
      athletes: [],
    });
    m.betaFeedback.findMany.mockResolvedValue([]);
    m.trainingProgram.findMany.mockResolvedValue([]);

    const out = await buildExportForUser("u1");

    expect(out._meta.role).toBe("COACH");
    expect(out._meta.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(out._meta.userId).toBe("u1");
    expect(out._meta.signedUrlExpiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("dispatches to athlete builder when role=ATHLETE", async () => {
    m.user.findUnique.mockResolvedValue({ id: "u2", role: "ATHLETE" });
    m.athleteProfile.findUnique.mockResolvedValue({
      id: "a1",
      userId: "u2",
      user: userRow("ATHLETE"),
      smartGoals: [],
      injuries: [],
      readinessCheckIns: [],
      assessments: [],
      throwLogs: [],
      throwsPRs: [],
      throwsDrillPRs: [],
      athleteImplementPRs: [],
      voiceNotes: [],
      coachNotes: [],
      trainingSessions: [],
      whoopConnection: null,
      ouraConnection: null,
      throwsTyping: null,
    });
    m.betaFeedback.findMany.mockResolvedValue([]);

    const out = await buildExportForUser("u2");

    expect(out._meta.role).toBe("ATHLETE");
  });

  it("throws when user not found", async () => {
    m.user.findUnique.mockResolvedValue(null);
    await expect(buildExportForUser("missing")).rejects.toThrow(/not found/);
  });
});

describe("buildCoachExport", () => {
  it("returns the canonical coach payload shape", async () => {
    m.coachProfile.findUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      user: userRow("COACH"),
      invitations: [{ id: "i1", email: "athlete@x.com" }],
      drills: [{ id: "d1", name: "Med ball throws" }],
      coachNotes: [{ id: "n1", body: "..." }],
      voiceNotes: [],
      questionnaires: [],
      coachPRs: [{ id: "pr1", distance: 22.5 }],
      coachTyping: { id: "ct1" },
      athletes: [
        {
          id: "a1",
          firstName: "Asha",
          lastName: "Patel",
          events: ["SHOT_PUT"],
          createdAt: new Date("2026-01-01"),
          user: { email: "asha@x.com", claimedAt: null },
        },
      ],
    });
    m.betaFeedback.findMany.mockResolvedValue([{ id: "bf1", type: "BUG", body: "..." }]);
    m.trainingProgram.findMany.mockResolvedValue([{ id: "tp1", name: "Fall block" }]);

    const out = await buildCoachExport("u1");

    expect(out).toHaveProperty("user");
    expect(out).toHaveProperty("coachProfile");
    expect(out).toHaveProperty("roster");
    expect(out).toHaveProperty("trainingPrograms");
    expect(out).toHaveProperty("feedbackSubmitted");
    expect(out.roster as unknown[]).toHaveLength(1);
    expect(out.trainingPrograms as unknown[]).toHaveLength(1);
    expect(out.feedbackSubmitted as unknown[]).toHaveLength(1);
  });

  it("throws when CoachProfile is missing", async () => {
    m.coachProfile.findUnique.mockResolvedValue(null);
    await expect(buildCoachExport("u1")).rejects.toThrow(/CoachProfile not found/);
  });
});

describe("buildAthleteExport", () => {
  it("returns the canonical athlete payload shape", async () => {
    m.athleteProfile.findUnique.mockResolvedValue({
      id: "a1",
      userId: "u2",
      user: userRow("ATHLETE"),
      smartGoals: [{ id: "g1", goal: "Throw 22m" }],
      injuries: [],
      readinessCheckIns: [{ id: "r1", score: 8 }],
      assessments: [],
      throwLogs: [
        { id: "t1", distance: 18.2 },
        { id: "t2", distance: 19.0 },
      ],
      throwsPRs: [{ id: "pr1", distance: 19.5 }],
      throwsDrillPRs: [],
      athleteImplementPRs: [],
      voiceNotes: [],
      coachNotes: [],
      trainingSessions: [],
      whoopConnection: { id: "wc1", accessToken: "secret-token", refreshToken: "secret-refresh" },
      ouraConnection: null,
      throwsTyping: null,
    });
    m.betaFeedback.findMany.mockResolvedValue([]);

    const out = await buildAthleteExport("u2");

    expect(out).toHaveProperty("user");
    expect(out).toHaveProperty("athleteProfile");
    expect((out.athleteProfile as { throwLogs: unknown[] }).throwLogs).toHaveLength(2);
    expect((out.athleteProfile as { throwsPRs: unknown[] }).throwsPRs).toHaveLength(1);
  });

  it("throws when AthleteProfile is missing", async () => {
    m.athleteProfile.findUnique.mockResolvedValue(null);
    await expect(buildAthleteExport("u2")).rejects.toThrow(/AthleteProfile not found/);
  });
});

describe("buildExportForUser — redaction integration", () => {
  it("strips passwordHash from the user object in the output", async () => {
    m.user.findUnique.mockResolvedValue({ id: "u3", role: "ATHLETE" });
    m.athleteProfile.findUnique.mockResolvedValue({
      id: "a1",
      userId: "u3",
      user: userRow("ATHLETE"),
      smartGoals: [],
      injuries: [],
      readinessCheckIns: [],
      assessments: [],
      throwLogs: [],
      throwsPRs: [],
      throwsDrillPRs: [],
      athleteImplementPRs: [],
      voiceNotes: [],
      coachNotes: [],
      trainingSessions: [],
      whoopConnection: null,
      ouraConnection: null,
      throwsTyping: null,
    });
    m.betaFeedback.findMany.mockResolvedValue([]);

    const out = await buildExportForUser("u3");
    const data = out.data as { user: { passwordHash: unknown } };
    expect(data.user.passwordHash).toBe("[REDACTED]");
  });

  it("strips OAuth tokens from nested whoopConnection", async () => {
    m.user.findUnique.mockResolvedValue({ id: "u4", role: "ATHLETE" });
    m.athleteProfile.findUnique.mockResolvedValue({
      id: "a1",
      userId: "u4",
      user: userRow("ATHLETE"),
      smartGoals: [],
      injuries: [],
      readinessCheckIns: [],
      assessments: [],
      throwLogs: [],
      throwsPRs: [],
      throwsDrillPRs: [],
      athleteImplementPRs: [],
      voiceNotes: [],
      coachNotes: [],
      trainingSessions: [],
      whoopConnection: { id: "wc1", accessToken: "leak", refreshToken: "leak2" },
      ouraConnection: null,
      throwsTyping: null,
    });
    m.betaFeedback.findMany.mockResolvedValue([]);

    const out = await buildExportForUser("u4");
    const data = out.data as {
      athleteProfile: { whoopConnection: { accessToken: unknown; refreshToken: unknown } };
    };
    expect(data.athleteProfile.whoopConnection.accessToken).toBe("[REDACTED]");
    expect(data.athleteProfile.whoopConnection.refreshToken).toBe("[REDACTED]");
  });
});
