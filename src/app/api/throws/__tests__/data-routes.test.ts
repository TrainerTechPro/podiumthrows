import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsCompetition: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    athleteThrowsSession: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    throwsCheckIn: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    throwsComplex: {
      create: (...args: unknown[]) => mockCreate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    practiceSession: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    coachProfile: {
      findUnique: vi.fn().mockResolvedValue({ id: "coach-1" }),
    },
  },
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    userId: "user-1",
    email: "coach@test.com",
    role: "COACH",
  }),
  getSession: vi.fn().mockResolvedValue({
    userId: "user-1",
    email: "coach@test.com",
    role: "COACH",
  }),
}));

vi.mock("@/lib/authorize", () => ({
  canAccessAthlete: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
  auditRequestInfo: vi.fn().mockReturnValue({ ip: "127.0.0.1", userAgent: "test" }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/coach-throws", () => ({
  checkAndSetCoachPR: vi.fn(),
}));

vi.mock("@/lib/data/coach", () => ({
  fetchCoachByUserId: vi.fn(),
  PLAN_LIMITS: { FREE: 3, PRO: 25, ELITE: Infinity },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { POST as competitionPOST, PATCH as competitionPATCH } from "../../throws/competitions/route";
import { POST as practicePOST } from "../../throws/practice/route";

// ════════════════════════════════════════════════════════════════════════════
// COMPETITIONS
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/throws/competitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: "comp-1" });
  });

  it("creates competition with valid data", async () => {
    const res = await competitionPOST(
      makeRequest({
        athleteId: "athlete-1",
        name: "State Championships",
        date: "2026-05-15",
        event: "SHOT_PUT",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await competitionPOST(
      makeRequest({
        athleteId: "athlete-1",
        name: "State Championships",
        // missing date and event
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 for empty athlete ID", async () => {
    const res = await competitionPOST(
      makeRequest({
        athleteId: "",
        name: "State Championships",
        date: "2026-05-15",
        event: "SHOT_PUT",
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts optional priority field", async () => {
    const res = await competitionPOST(
      makeRequest({
        athleteId: "athlete-1",
        name: "Nationals",
        date: "2026-06-20",
        event: "DISCUS",
        priority: "A",
        result: 52.3,
        notes: "Season opener",
      })
    );
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/throws/competitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: "comp-1",
      athleteId: "athlete-1",
    });
    mockUpdate.mockResolvedValue({ id: "comp-1" });
  });

  it("updates competition result", async () => {
    const res = await competitionPATCH(
      makePatchRequest({
        id: "comp-1",
        result: 18.42,
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 for missing ID", async () => {
    const res = await competitionPATCH(
      makePatchRequest({
        result: 18.42,
      })
    );
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PRACTICE SESSIONS
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/throws/practice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: "practice-1" });
  });

  it("creates practice session with valid data", async () => {
    const res = await practicePOST(
      makeRequest({
        name: "Morning Throws",
        date: "2026-03-27",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns 400 for missing name", async () => {
    const res = await practicePOST(
      makeRequest({
        date: "2026-03-27",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing date", async () => {
    const res = await practicePOST(
      makeRequest({
        name: "Morning Throws",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await practicePOST(req);
    expect(res.status).toBe(400);
  });
});
