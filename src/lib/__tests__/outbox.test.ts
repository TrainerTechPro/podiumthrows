import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// In-memory IDB stand-in. The outbox reads/writes via openDB+idb* helpers,
// so mocking those gives full coverage without dragging in fake-indexeddb.
type OutboxRecord = {
  id: string;
  url: string;
  method: string;
  bodyJson: unknown;
  idempotencyKey: string;
  metadata: Record<string, unknown> | undefined;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
};
const store = new Map<string, OutboxRecord>();

vi.mock("@/lib/pwa/idb", () => ({
  openDB: vi.fn(async () => ({ close: () => {} })),
  idbGet: vi.fn(async (_db: unknown, _store: string, key: string) => store.get(key)),
  idbPut: vi.fn(async (_db: unknown, _store: string, value: OutboxRecord) => {
    store.set(value.id, value);
  }),
  idbDelete: vi.fn(async (_db: unknown, _store: string, key: string) => {
    store.delete(key);
  }),
  idbGetAll: vi.fn(async () => Array.from(store.values())),
  idbCount: vi.fn(async () => store.size),
}));

vi.mock("@/lib/csrf-client", () => ({
  // Always return a fresh token at replay time — guards against the queue
  // baking in a stale token at enqueue time.
  csrfHeaders: vi.fn(() => ({ "X-CSRF-Token": "fresh-token-" + Date.now() })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { enqueueMutation, drainOutbox, getOutboxPending, __resetOutboxForTest } from "../outbox";
import { csrfHeaders } from "@/lib/csrf-client";

const fetchMock = vi.fn();
beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  __resetOutboxForTest();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("outbox — enqueue", () => {
  it("stores envelope with all required fields", async () => {
    await enqueueMutation({
      url: "/api/x",
      method: "POST",
      bodyJson: { foo: 1 },
      idempotencyKey: "abc-123",
    });
    expect(store.size).toBe(1);
    const r = Array.from(store.values())[0];
    expect(r.url).toBe("/api/x");
    expect(r.method).toBe("POST");
    expect(r.bodyJson).toEqual({ foo: 1 });
    expect(r.idempotencyKey).toBe("abc-123");
    expect(r.attempts).toBe(0);
    expect(typeof r.createdAt).toBe("number");
  });

  it("each enqueued item gets a unique id", async () => {
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k2" });
    expect(store.size).toBe(2);
  });
});

describe("outbox — drain", () => {
  it("posts each pending item with fresh csrfHeaders + Idempotency-Key", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    await enqueueMutation({
      url: "/api/x",
      method: "POST",
      bodyJson: { foo: 1 },
      idempotencyKey: "abc-123",
    });

    await drainOutbox();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(csrfHeaders).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/x");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Idempotency-Key"]).toBe("abc-123");
    expect(headers["X-CSRF-Token"]).toMatch(/^fresh-token-/);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ foo: 1 }));
  });

  it("removes item from queue on 2xx response", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });
    expect(store.size).toBe(1);

    await drainOutbox();

    expect(store.size).toBe(0);
  });

  it("retains item on 5xx response and increments attempts + schedules backoff", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 503 }));
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });

    await drainOutbox();

    expect(store.size).toBe(1);
    const r = Array.from(store.values())[0];
    expect(r.attempts).toBe(1);
    expect(r.nextAttemptAt).toBeGreaterThan(Date.now());
  });

  it("retains item on network failure (fetch rejection)", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });

    await drainOutbox();

    expect(store.size).toBe(1);
    expect(Array.from(store.values())[0].attempts).toBe(1);
  });

  it("drops item on 400 — request is bad, no point retrying", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "bad" }), { status: 400 }));
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });

    await drainOutbox();

    expect(store.size).toBe(0);
  });

  it("drops item on 422 (idempotency-key reused with different body)", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "key reused" }), { status: 422 })
    );
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });

    await drainOutbox();

    expect(store.size).toBe(0);
  });

  it("retains item on 429 (rate-limited) and 408 (timeout)", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });
    await drainOutbox();
    expect(store.size).toBe(1);

    store.clear();
    fetchMock.mockResolvedValue(new Response("", { status: 408 }));
    await enqueueMutation({ url: "/y", method: "POST", bodyJson: {}, idempotencyKey: "k2" });
    await drainOutbox();
    expect(store.size).toBe(1);
  });

  it("on 401 parks the queue (item retained, no further drain attempts in this run)", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));
    await enqueueMutation({ url: "/a", method: "POST", bodyJson: {}, idempotencyKey: "ka" });
    await enqueueMutation({ url: "/b", method: "POST", bodyJson: {}, idempotencyKey: "kb" });

    await drainOutbox();

    // First request 401s, second never attempted (parked).
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(store.size).toBe(2);
  });

  it("skips items whose nextAttemptAt is in the future", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });
    // Hack: bump the queued item's nextAttemptAt 60s into the future.
    const r = Array.from(store.values())[0];
    r.nextAttemptAt = Date.now() + 60_000;
    store.set(r.id, r);

    await drainOutbox();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
  });

  it("backoff schedule grows as attempts increase", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });

    const start = Date.now();
    await drainOutbox(); // attempts = 1
    const r1 = Array.from(store.values())[0];
    const delay1 = r1.nextAttemptAt - start;

    // Force-eligible again to advance attempts.
    r1.nextAttemptAt = Date.now() - 1;
    store.set(r1.id, r1);
    await drainOutbox(); // attempts = 2
    const r2 = Array.from(store.values())[0];
    const delay2 = r2.nextAttemptAt - Date.now();

    expect(delay2).toBeGreaterThan(delay1);
  });
});

describe("outbox — getOutboxPending", () => {
  it("returns the count of queued items", async () => {
    expect(await getOutboxPending()).toBe(0);
    await enqueueMutation({ url: "/x", method: "POST", bodyJson: {}, idempotencyKey: "k1" });
    await enqueueMutation({ url: "/y", method: "POST", bodyJson: {}, idempotencyKey: "k2" });
    expect(await getOutboxPending()).toBe(2);
  });
});
