import { describe, it, expect, vi, beforeEach } from "vitest";

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
    workoutPlan: { create: vi.fn() },
  },
}));

vi.mock("@/lib/idempotency", () => ({
  withIdempotency: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { POST } from "@/app/api/coach/plans/route";
import { getSession } from "@/lib/auth";
import { withIdempotency } from "@/lib/idempotency";
import prisma from "@/lib/prisma";

const NextRequest = global.Request as unknown as new (
  input: RequestInfo,
  init?: RequestInit
) => Request;

function makeReq(body: unknown): Request {
  return new NextRequest("http://localhost/api/coach/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/coach/plans — canonical envelope + parseBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 + Validation failed envelope when blocks array is empty", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      role: "COACH",
    });
    (prisma.coachProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1" });
    (withIdempotency as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_ctx, handler) =>
      handler('{"name":"x","blocks":[]}')
    );

    const res = await POST(makeReq({}) as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Validation failed");
  });

  it("returns canonical { success: true, data: { id, name } } on success", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      role: "COACH",
    });
    (prisma.coachProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "c1" });
    (prisma.workoutPlan.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "plan-1",
      name: "Day 1",
    });
    (withIdempotency as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_ctx, handler) =>
      handler(
        JSON.stringify({
          name: "Day 1",
          blocks: [{ name: "Block 1", blockType: "throwing" }],
        })
      )
    );

    const res = await POST(makeReq({}) as never);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data?.id).toBe("plan-1");
    // No flat top-level fields
    expect(body.id).toBeUndefined();
    expect(body.name).toBeUndefined();
  });
});
