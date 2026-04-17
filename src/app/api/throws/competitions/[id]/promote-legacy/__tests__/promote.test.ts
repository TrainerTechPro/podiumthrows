import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCompFindUnique = vi.fn();
const mockProfileFindUnique = vi.fn();
const mockProfileUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsCompetition: { findUnique: (...a: unknown[]) => mockCompFindUnique(...a) },
    athleteProfile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
      update: (...a: unknown[]) => mockProfileUpdate(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({ canAccessAthlete: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "../route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /promote-legacy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes legacy result to competitionPRs when it exceeds stored value", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1", athleteId: "a1", event: "SHOT_PUT", result: 18.42,
    });
    mockProfileFindUnique.mockResolvedValue({ competitionPRs: { SHOT_PUT: 18.0 } });
    mockProfileUpdate.mockResolvedValue({ competitionPRs: { SHOT_PUT: 18.42 } });

    const req = new NextRequest("http://t", { method: "POST", body: "{}" });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockProfileUpdate).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { competitionPRs: { SHOT_PUT: 18.42 } },
    });
  });

  it("is idempotent when stored value is higher", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1", athleteId: "a1", event: "SHOT_PUT", result: 17.5,
    });
    mockProfileFindUnique.mockResolvedValue({ competitionPRs: { SHOT_PUT: 18.0 } });

    const req = new NextRequest("http://t", { method: "POST", body: "{}" });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(200);
    expect(mockProfileUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when meet has no legacy result", async () => {
    mockCompFindUnique.mockResolvedValue({
      id: "m1", athleteId: "a1", event: "SHOT_PUT", result: null,
    });
    const req = new NextRequest("http://t", { method: "POST", body: "{}" });
    const res = await POST(req, ctx("m1"));
    expect(res.status).toBe(400);
  });
});
