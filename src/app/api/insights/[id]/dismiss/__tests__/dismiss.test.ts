import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  canAccessAthlete: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    athleteInsight: {
      findUnique: (...a: unknown[]) => mocks.findUnique(...a),
      update: (...a: unknown[]) => mocks.update(...a),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ userId: "u1", email: "c@test.com", role: "COACH" }),
}));
vi.mock("@/lib/authorize", () => ({
  canAccessAthlete: (...a: unknown[]) => mocks.canAccessAthlete(...a),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { PATCH } from "../route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/insights/[id]/dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canAccessAthlete.mockResolvedValue(true);
  });

  it("empty body sets dismissedAt to a new Date", async () => {
    mocks.findUnique.mockResolvedValue({ athleteId: "a1" });
    mocks.update.mockResolvedValue({ id: "i1", dismissedAt: new Date() });

    const req = new NextRequest("http://t/api/insights/i1/dismiss", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(200);

    const call = mocks.update.mock.calls[0][0];
    expect(call.data.dismissedAt).toBeInstanceOf(Date);
  });

  it("undismiss: true clears dismissedAt to null", async () => {
    mocks.findUnique.mockResolvedValue({ athleteId: "a1" });
    mocks.update.mockResolvedValue({ id: "i1", dismissedAt: null });

    const req = new NextRequest("http://t/api/insights/i1/dismiss", {
      method: "PATCH",
      body: JSON.stringify({ undismiss: true }),
    });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(200);

    const call = mocks.update.mock.calls[0][0];
    expect(call.data.dismissedAt).toBeNull();
  });

  it("404 when insight not found", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const req = new NextRequest("http://t/api/insights/i1/dismiss", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(404);
  });

  it("403 when canAccessAthlete returns false", async () => {
    mocks.findUnique.mockResolvedValue({ athleteId: "a1" });
    mocks.canAccessAthlete.mockResolvedValueOnce(false);

    const req = new NextRequest("http://t/api/insights/i1/dismiss", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, ctx("i1"));
    expect(res.status).toBe(403);
  });
});
