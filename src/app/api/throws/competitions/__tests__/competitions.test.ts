import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockFindMany = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    throwsCompetition: {
      create: (...args: unknown[]) => mockCreate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({
  canAccessAthlete: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { POST } from "../route";

describe("POST /api/throws/competitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates meet with v2 context fields", async () => {
    mockCreate.mockResolvedValue({ id: "m1", athleteId: "a1" });
    const req = new NextRequest("http://t/api/throws/competitions", {
      method: "POST",
      body: JSON.stringify({
        athleteId: "a1",
        name: "NCAA East",
        date: "2026-05-15",
        event: "SHOT_PUT",
        venueType: "OUTDOOR",
        windMps: -1.2,
        placeFinish: 3,
        format: "THREE_PLUS_THREE",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        venueType: "OUTDOOR",
        windMps: -1.2,
        placeFinish: 3,
        format: "THREE_PLUS_THREE",
      }),
    });
  });

  it("rejects placeFinish of 0", async () => {
    const req = new NextRequest("http://t/api/throws/competitions", {
      method: "POST",
      body: JSON.stringify({
        athleteId: "a1",
        name: "X",
        date: "2026-05-15",
        event: "SHOT_PUT",
        placeFinish: 0,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
