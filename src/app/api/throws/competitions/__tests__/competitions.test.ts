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

import { POST, GET, PATCH, DELETE } from "../route";

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

describe("GET /api/throws/competitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns meets with derived bestMark and throwCount", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "m1",
        athleteId: "a1",
        name: "A",
        date: "2026-05-15",
        event: "SHOT_PUT",
        result: null,
        _count: { throws: 3 },
        throws: [
          { distance: 18.0, isFoul: false, isPass: false },
          { distance: null, isFoul: true, isPass: false },
          { distance: 18.42, isFoul: false, isPass: false },
        ],
      },
    ]);
    const req = new NextRequest("http://t/api/throws/competitions?athleteId=a1");
    const res = await GET(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].bestMark).toBe(18.42);
    expect(body.data[0].throwCount).toBe(3);
  });

  it("falls back to legacy result for rows with no throws", async () => {
    mockFindMany.mockResolvedValue([
      { id: "m2", athleteId: "a1", name: "Legacy", date: "2025-05-15", event: "SHOT_PUT", result: 17.3, _count: { throws: 0 }, throws: [] },
    ]);
    const req = new NextRequest("http://t/api/throws/competitions?athleteId=a1");
    const res = await GET(req);
    const body = await res.json();
    expect(body.data[0].bestMark).toBe(17.3);
    expect(body.data[0].throwCount).toBe(0);
  });
});

describe("PATCH /api/throws/competitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates v2 fields", async () => {
    mockFindUnique.mockResolvedValue({ id: "m1", athleteId: "a1" });
    mockUpdate.mockResolvedValue({ id: "m1", athleteId: "a1", placeFinish: 2 });
    const req = new NextRequest("http://t/api/throws/competitions", {
      method: "PATCH",
      body: JSON.stringify({ id: "m1", placeFinish: 2, madeFinals: true }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ placeFinish: 2, madeFinals: true }),
      })
    );
  });
});

describe("DELETE /api/throws/competitions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes meet after authorization", async () => {
    mockFindUnique.mockResolvedValue({ id: "m1", athleteId: "a1" });
    mockDelete.mockResolvedValue({ id: "m1" });
    const req = new NextRequest("http://t/api/throws/competitions?id=m1", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });

  it("returns 404 if not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const req = new NextRequest("http://t/api/throws/competitions?id=missing", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });
});
