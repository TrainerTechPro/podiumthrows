import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    athleteProfile: { findUnique: vi.fn() },
    throwLog: { findMany: vi.fn() },
    throwsBlockLog: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET } from "@/app/api/throws/history/route";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

describe("GET /api/throws/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = new Request("http://localhost/api/throws/history");
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 403 when user has no athlete profile", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", role: "ATHLETE" });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const req = new Request("http://localhost/api/throws/history");
    const res = await GET(req as never);
    expect(res.status).toBe(403);
  });

  it("returns empty days array when athlete has no logs", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", role: "ATHLETE" });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1" });
    (prisma.throwLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.throwsBlockLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = new Request("http://localhost/api/throws/history");
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.days).toEqual([]);
    expect(body.data.totals.sessions).toBe(0);
    expect(body.data.totals.throws).toBe(0);
  });

  it("returns 400 for invalid range param", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", role: "ATHLETE" });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1" });

    const req = new Request("http://localhost/api/throws/history?range=bogus");
    const res = await GET(req as never);
    expect(res.status).toBe(400);
  });

  it("aggregates free logs and block logs into day rows", async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "u1", role: "ATHLETE" });
    (prisma.athleteProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "a1" });
    (prisma.throwLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "t1", athleteId: "a1", event: "SHOT_PUT", implementWeight: 7.26,
        distance: 18.42, date: new Date("2026-04-08T12:00:00Z"),
        isPersonalBest: true, isCompetition: false, sessionId: null,
      },
    ]);
    (prisma.throwsBlockLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = new Request("http://localhost/api/throws/history?range=30d");
    const res = await GET(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.days).toHaveLength(1);
    expect(body.data.days[0].date).toBe("2026-04-08");
    expect(body.data.totals.throws).toBe(1);
  });
});
