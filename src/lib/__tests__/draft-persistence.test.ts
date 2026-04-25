import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory IDB stand-in. The hook reads/writes via openDB+idb* helpers, so
// mocking those gives full coverage without depending on fake-indexeddb.
type DraftRecord = { key: string; userId: string; data: unknown; timestamp: number };
const store = new Map<string, DraftRecord>();

vi.mock("@/lib/pwa/idb", () => ({
  openDB: vi.fn(async () => ({ close: () => {} })),
  idbGet: vi.fn(async (_db: unknown, _store: string, key: string) => store.get(key)),
  idbPut: vi.fn(async (_db: unknown, _store: string, value: DraftRecord) => {
    store.set(value.key, value);
  }),
  idbDelete: vi.fn(async (_db: unknown, _store: string, key: string) => {
    store.delete(key);
  }),
  idbGetAll: vi.fn(async () => Array.from(store.values())),
  idbCount: vi.fn(async () => store.size),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import {
  clearAllStaleDrafts,
  clearAllUserDrafts,
  persistDraftForTest,
  readDraftForTest,
} from "../draft-persistence";

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("draft-persistence — store-level helpers", () => {
  it("persistDraftForTest writes envelope with userId derived from key", async () => {
    await persistDraftForTest("u1:quick-log:abc", { distance: 18.4 });
    const r = store.get("u1:quick-log:abc")!;
    expect(r.userId).toBe("u1");
    expect(r.data).toEqual({ distance: 18.4 });
    expect(typeof r.timestamp).toBe("number");
  });

  it("readDraftForTest returns the data when fresh", async () => {
    await persistDraftForTest("u1:k:1", { x: 1 });
    const data = await readDraftForTest<{ x: number }>("u1:k:1");
    expect(data).toEqual({ x: 1 });
  });

  it("readDraftForTest returns null for stale envelopes (>7d)", async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    store.set("u1:k:1", { key: "u1:k:1", userId: "u1", data: { x: 1 }, timestamp: eightDaysAgo });
    expect(await readDraftForTest<{ x: number }>("u1:k:1")).toBeNull();
  });

  it("readDraftForTest returns null when envelope userId mismatches the key prefix", async () => {
    // Defense against a malicious or corrupted row whose `userId` field
    // disagrees with the cache-key namespace.
    store.set("u1:k:1", {
      key: "u1:k:1",
      userId: "u2", // mismatch
      data: { x: 1 },
      timestamp: Date.now(),
    });
    expect(await readDraftForTest<{ x: number }>("u1:k:1")).toBeNull();
  });

  it("persistDraftForTest skips writes that exceed the 500KB cap", async () => {
    const huge = { blob: "x".repeat(600_000) };
    await persistDraftForTest("u1:k:1", huge);
    expect(store.has("u1:k:1")).toBe(false);
  });

  it("clearAllStaleDrafts removes only entries older than 7 days", async () => {
    const fresh = Date.now() - 60_000;
    const stale = Date.now() - 8 * 24 * 60 * 60 * 1000;
    store.set("u1:fresh:1", { key: "u1:fresh:1", userId: "u1", data: 1, timestamp: fresh });
    store.set("u1:stale:1", { key: "u1:stale:1", userId: "u1", data: 1, timestamp: stale });
    store.set("u2:stale:1", { key: "u2:stale:1", userId: "u2", data: 1, timestamp: stale });

    const removed = await clearAllStaleDrafts();

    expect(removed).toBe(2);
    expect(store.has("u1:fresh:1")).toBe(true);
    expect(store.has("u1:stale:1")).toBe(false);
    expect(store.has("u2:stale:1")).toBe(false);
  });

  it("clearAllUserDrafts removes only that user's entries, regardless of age", async () => {
    store.set("u1:a:1", { key: "u1:a:1", userId: "u1", data: 1, timestamp: Date.now() });
    store.set("u1:b:1", { key: "u1:b:1", userId: "u1", data: 1, timestamp: Date.now() });
    store.set("u2:a:1", { key: "u2:a:1", userId: "u2", data: 1, timestamp: Date.now() });

    const removed = await clearAllUserDrafts("u1");

    expect(removed).toBe(2);
    expect(store.has("u1:a:1")).toBe(false);
    expect(store.has("u1:b:1")).toBe(false);
    expect(store.has("u2:a:1")).toBe(true);
  });

  it("clearAllUserDrafts on a user with no drafts returns 0 and does not throw", async () => {
    expect(await clearAllUserDrafts("ghost")).toBe(0);
  });
});
