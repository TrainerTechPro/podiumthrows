import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/* ─── Mocks ──────────────────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  pushSubscriptionUpsert: vi.fn(),
  pushSubscriptionDeleteMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: (...a: unknown[]) => mocks.getSession(...a),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    pushSubscription: {
      upsert: (...a: unknown[]) => mocks.pushSubscriptionUpsert(...a),
      deleteMany: (...a: unknown[]) => mocks.pushSubscriptionDeleteMany(...a),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST, DELETE } from "../route";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const VALID_SUB = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: {
    p256dh: "BPublicKeyBase64Encoded",
    auth: "AuthSecretBase64Encoded",
  },
  expirationTime: null,
};

function makeRequest(method: "POST" | "DELETE", body: unknown) {
  return new NextRequest("http://localhost/api/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json", "user-agent": "vitest" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

/* ─── POST ──────────────────────────────────────────────────────────────── */

describe("POST /api/push/subscribe", () => {
  it("returns 401 when no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", VALID_SUB));
    expect(res.status).toBe(401);
    const payload = await res.json();
    expect(payload).toEqual({ success: false, error: "Unauthorized" });
    expect(mocks.pushSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it("upserts a valid subscription for the authenticated user", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1", role: "ATHLETE" });
    mocks.pushSubscriptionUpsert.mockResolvedValue({ id: "sub-1" });

    const res = await POST(makeRequest("POST", VALID_SUB));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.pushSubscriptionUpsert).toHaveBeenCalledTimes(1);
    const arg = mocks.pushSubscriptionUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ endpoint: VALID_SUB.endpoint });
    expect(arg.create).toMatchObject({
      userId: "user-1",
      endpoint: VALID_SUB.endpoint,
      p256dh: VALID_SUB.keys.p256dh,
      authSecret: VALID_SUB.keys.auth,
    });
    expect(arg.update).toMatchObject({
      userId: "user-1",
      p256dh: VALID_SUB.keys.p256dh,
      authSecret: VALID_SUB.keys.auth,
    });
  });

  it("re-subscribing the same browser updates instead of duplicating", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1", role: "ATHLETE" });
    mocks.pushSubscriptionUpsert.mockResolvedValue({ id: "sub-1" });

    await POST(makeRequest("POST", VALID_SUB));
    await POST(makeRequest("POST", VALID_SUB));

    // Both calls hit upsert keyed on the same endpoint — Prisma does the dedupe.
    expect(mocks.pushSubscriptionUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.pushSubscriptionUpsert.mock.calls[0][0].where.endpoint).toBe(VALID_SUB.endpoint);
    expect(mocks.pushSubscriptionUpsert.mock.calls[1][0].where.endpoint).toBe(VALID_SUB.endpoint);
  });

  it("returns 400 when endpoint is missing", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1", role: "ATHLETE" });
    const res = await POST(makeRequest("POST", { keys: VALID_SUB.keys }));
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/endpoint/);
    expect(mocks.pushSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it("returns 400 when keys.p256dh or keys.auth is missing", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1", role: "ATHLETE" });

    const noP256 = await POST(
      makeRequest("POST", {
        endpoint: VALID_SUB.endpoint,
        keys: { auth: VALID_SUB.keys.auth },
      })
    );
    expect(noP256.status).toBe(400);

    const noAuth = await POST(
      makeRequest("POST", {
        endpoint: VALID_SUB.endpoint,
        keys: { p256dh: VALID_SUB.keys.p256dh },
      })
    );
    expect(noAuth.status).toBe(400);

    expect(mocks.pushSubscriptionUpsert).not.toHaveBeenCalled();
  });

  it("returns 500 if the database write throws", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1", role: "ATHLETE" });
    mocks.pushSubscriptionUpsert.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest("POST", VALID_SUB));
    expect(res.status).toBe(500);
    const payload = await res.json();
    expect(payload.success).toBe(false);
  });
});

/* ─── DELETE ────────────────────────────────────────────────────────────── */

describe("DELETE /api/push/subscribe", () => {
  it("returns 401 when no session", async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await DELETE(makeRequest("DELETE", { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(401);
    expect(mocks.pushSubscriptionDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 400 when endpoint is missing", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1", role: "ATHLETE" });
    const res = await DELETE(makeRequest("DELETE", {}));
    expect(res.status).toBe(400);
    expect(mocks.pushSubscriptionDeleteMany).not.toHaveBeenCalled();
  });

  it("scopes the delete to the calling user — never another user's subs", async () => {
    mocks.getSession.mockResolvedValue({ userId: "user-1", role: "ATHLETE" });
    mocks.pushSubscriptionDeleteMany.mockResolvedValue({ count: 1 });

    const res = await DELETE(makeRequest("DELETE", { endpoint: VALID_SUB.endpoint }));
    expect(res.status).toBe(200);
    expect(mocks.pushSubscriptionDeleteMany).toHaveBeenCalledWith({
      where: { endpoint: VALID_SUB.endpoint, userId: "user-1" },
    });
  });
});
