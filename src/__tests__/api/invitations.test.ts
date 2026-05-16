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
    athleteProfile: { findFirst: vi.fn(), count: vi.fn() },
    invitation: { updateMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  auditRequestInfo: vi.fn(() => ({})),
}));

vi.mock("@/lib/invitation-token", () => ({
  generateInvitationToken: () => ({ raw: "raw-token", hashed: "hashed-token" }),
}));

vi.mock("@/lib/data/coach", () => ({
  PLAN_LIMITS: { FREE: 3, PRO: 25, ELITE: Infinity },
}));

vi.mock("@/lib/email", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { POST } from "@/app/api/invitations/route";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/invitations — canonical envelope + Zod validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 + Validation failed when email is invalid", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      role: "COACH",
    });
    (prisma.coachProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "c1",
      firstName: "Coach",
      lastName: "Smith",
      plan: "PRO",
    });
    (prisma.athleteProfile.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const res = await POST(makeReq({ mode: "email", email: "not-an-email" }) as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Validation failed");
    expect(Array.isArray(body.fieldErrors)).toBe(true);
  });

  it("returns canonical { success: true, data: { token, emailSent, ... } } — emailSent nested under data, not flat", async () => {
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      role: "COACH",
    });
    (prisma.coachProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "c1",
      firstName: "Coach",
      lastName: "Smith",
      plan: "PRO",
    });
    (prisma.athleteProfile.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (prisma.athleteProfile.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.invitation.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    (prisma.invitation.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "inv-1",
      email: "athlete@example.com",
      status: "PENDING",
      expiresAt: new Date(),
      createdAt: new Date(),
    });

    const res = await POST(makeReq({ mode: "email", email: "athlete@example.com" }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.token).toBe("raw-token");
    expect(typeof body.data?.emailSent).toBe("boolean");
    // The legacy flat `emailSent` sibling must be gone (it was dead and confusing).
    expect(body.emailSent).toBeUndefined();
  });
});
