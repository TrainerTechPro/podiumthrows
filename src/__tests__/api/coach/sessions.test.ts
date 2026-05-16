import { describe, it, expect, vi, beforeEach } from "vitest";

// React.cache() is server-only and not available in Vitest.
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), cache: (fn: unknown) => fn };
});

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    coachProfile: { findUnique: vi.fn() },
    workoutPlan: { findFirst: vi.fn() },
    athleteProfile: { findMany: vi.fn() },
    trainingSession: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/idempotency", () => ({
  withIdempotency: vi.fn(async (_ctx, handler) =>
    handler('{"planId":"p1","athleteIds":["a1"],"scheduledDate":"2026-06-01"}')
  ),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { POST } from "@/app/api/coach/sessions/route";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

const NextRequest = global.Request as unknown as new (
  input: RequestInfo,
  init?: RequestInit
) => Request;

function makeReq(body: unknown): Request {
  return new NextRequest("http://localhost/api/coach/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/coach/sessions — canonical envelope + parseBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 + canonical error envelope when not a coach", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(makeReq({}) as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
  });

  it("returns 400 + fieldErrors envelope when planId is missing", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      role: "COACH",
    });
    (prisma.coachProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1" });

    // Override withIdempotency to feed an invalid body
    const { withIdempotency } = await import("@/lib/idempotency");
    (withIdempotency as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_ctx, handler) =>
      handler('{"athleteIds":["a1"],"scheduledDate":"2026-06-01"}')
    );

    const res = await POST(makeReq({}) as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Validation failed");
    expect(Array.isArray(body.fieldErrors)).toBe(true);
  });

  it("returns canonical { success: true, data: { created, scheduledDate } } on success", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      role: "COACH",
    });
    (prisma.coachProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1" });
    (prisma.workoutPlan.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
    (prisma.athleteProfile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "a1" }]);
    (prisma.trainingSession.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1,
    });

    const res = await POST(makeReq({}) as never);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.created).toBe(1);
    // No flat top-level `created` or `scheduledDate`
    expect(body.created).toBeUndefined();
    expect(body.scheduledDate).toBeUndefined();
  });
});
