import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    idempotencyKey: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockCreate(...a),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { withIdempotency } from "../idempotency";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function makeReq(body: string, headers: Record<string, string> = {}): NextRequest {
  const lowered = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    text: async () => body,
    headers: { get: (k: string) => lowered[k.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withIdempotency", () => {
  it("bypasses cache and runs handler when no X-Idempotency-Key header", async () => {
    const handler = vi.fn(async () => NextResponse.json({ success: true, data: "ok" }));
    const req = makeReq('{"foo":1}');

    const res = await withIdempotency({ userId: "u1", endpoint: "/api/x", req }, handler);

    expect(handler).toHaveBeenCalledWith('{"foo":1}');
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("runs handler and caches response on cache miss", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});
    const handler = vi.fn(async () =>
      NextResponse.json({ success: true, data: "created" }, { status: 201 })
    );
    const req = makeReq('{"foo":1}', { "x-idempotency-key": "abc-123" });

    const res = await withIdempotency({ userId: "u1", endpoint: "/api/x", req }, handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledOnce();
    const createData = mockCreate.mock.calls[0][0].data;
    expect(createData).toMatchObject({
      key: "abc-123",
      userId: "u1",
      endpoint: "/api/x",
      responseStatus: 201,
      responseBody: { success: true, data: "created" },
    });
    expect(createData.requestHash).toBe(sha256('{"foo":1}'));
    expect(res.status).toBe(201);
  });

  it("returns cached response and skips handler on cache hit (matching body hash)", async () => {
    mockFindUnique.mockResolvedValue({
      requestHash: sha256('{"foo":1}'),
      responseStatus: 201,
      responseBody: { success: true, data: "from-cache" },
    });
    const handler = vi.fn();
    const req = makeReq('{"foo":1}', { "x-idempotency-key": "abc-123" });

    const res = await withIdempotency({ userId: "u1", endpoint: "/api/x", req }, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: "from-cache" });
  });

  it("returns 422 when same key reused with different request body", async () => {
    mockFindUnique.mockResolvedValue({
      requestHash: sha256('{"foo":1}'),
      responseStatus: 201,
      responseBody: { success: true },
    });
    const handler = vi.fn();
    const req = makeReq('{"foo":2}', { "x-idempotency-key": "abc-123" });

    const res = await withIdempotency({ userId: "u1", endpoint: "/api/x", req }, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/idempotency.*different/i);
  });

  it("does not cache 4xx responses", async () => {
    mockFindUnique.mockResolvedValue(null);
    const handler = vi.fn(async () =>
      NextResponse.json({ success: false, error: "bad input" }, { status: 400 })
    );
    const req = makeReq("{}", { "x-idempotency-key": "abc-123" });

    const res = await withIdempotency({ userId: "u1", endpoint: "/api/x", req }, handler);

    expect(handler).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
  });

  it("does not cache 5xx responses", async () => {
    mockFindUnique.mockResolvedValue(null);
    const handler = vi.fn(async () =>
      NextResponse.json({ success: false, error: "boom" }, { status: 500 })
    );
    const req = makeReq("{}", { "x-idempotency-key": "abc-123" });

    const res = await withIdempotency({ userId: "u1", endpoint: "/api/x", req }, handler);

    expect(handler).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.status).toBe(500);
  });

  it("scopes cache lookups by userId+endpoint+key", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});
    const handler = vi.fn(async () => NextResponse.json({ success: true }));
    const req = makeReq("{}", { "x-idempotency-key": "abc-123" });

    await withIdempotency({ userId: "user-A", endpoint: "/api/x", req }, handler);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: {
        userId_endpoint_key: { userId: "user-A", endpoint: "/api/x", key: "abc-123" },
      },
    });
  });

  it("returns the handler response even when cache write races (P2002)", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockRejectedValue(new Error("Unique constraint violation"));
    const handler = vi.fn(async () =>
      NextResponse.json({ success: true, data: "ok" }, { status: 201 })
    );
    const req = makeReq("{}", { "x-idempotency-key": "abc-123" });

    const res = await withIdempotency({ userId: "u1", endpoint: "/api/x", req }, handler);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: "ok" });
  });

  it("computes the same body hash for the same input regardless of key", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});
    const handler = vi.fn(async () => NextResponse.json({ success: true }));

    await withIdempotency(
      { userId: "u", endpoint: "/x", req: makeReq('{"a":1,"b":2}', { "x-idempotency-key": "k1" }) },
      handler
    );
    const hash1 = mockCreate.mock.calls[0][0].data.requestHash;

    mockCreate.mockClear();
    await withIdempotency(
      { userId: "u", endpoint: "/x", req: makeReq('{"a":1,"b":2}', { "x-idempotency-key": "k2" }) },
      handler
    );
    const hash2 = mockCreate.mock.calls[0][0].data.requestHash;

    expect(hash1).toBe(hash2);
  });
});
