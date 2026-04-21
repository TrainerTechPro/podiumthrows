// src/lib/__tests__/notifications-comment.test.ts
import { describe, it, expect } from "vitest";
import { inQuietHours } from "../notifications/comment";

describe("inQuietHours — overnight window (22:00 → 07:00 in UTC)", () => {
  const prefs = { quietStart: "22:00", quietEnd: "07:00", timezone: "UTC" };

  it("is quiet at 23:00 UTC", () => {
    expect(inQuietHours(prefs, new Date("2026-04-21T23:00:00Z"))).toBe(true);
  });

  it("is quiet at 01:00 UTC (past midnight)", () => {
    expect(inQuietHours(prefs, new Date("2026-04-21T01:00:00Z"))).toBe(true);
  });

  it("is NOT quiet at 07:00 UTC (end of window is exclusive)", () => {
    expect(inQuietHours(prefs, new Date("2026-04-21T07:00:00Z"))).toBe(false);
  });

  it("is NOT quiet at 14:00 UTC", () => {
    expect(inQuietHours(prefs, new Date("2026-04-21T14:00:00Z"))).toBe(false);
  });

  it("is quiet at 22:00 UTC (start of window is inclusive)", () => {
    expect(inQuietHours(prefs, new Date("2026-04-21T22:00:00Z"))).toBe(true);
  });
});

describe("inQuietHours — same-day window (13:00 → 15:00 UTC)", () => {
  const prefs = { quietStart: "13:00", quietEnd: "15:00", timezone: "UTC" };

  it("is quiet at 14:00 UTC", () => {
    expect(inQuietHours(prefs, new Date("2026-04-21T14:00:00Z"))).toBe(true);
  });

  it("is NOT quiet at 12:59 UTC", () => {
    expect(inQuietHours(prefs, new Date("2026-04-21T12:59:00Z"))).toBe(false);
  });

  it("is NOT quiet at 15:00 UTC (end exclusive)", () => {
    expect(inQuietHours(prefs, new Date("2026-04-21T15:00:00Z"))).toBe(false);
  });
});

describe("inQuietHours — misconfiguration", () => {
  it("returns false when quietStart is missing", () => {
    expect(
      inQuietHours(
        { quietStart: null, quietEnd: "07:00", timezone: "UTC" },
        new Date("2026-04-21T23:00:00Z")
      )
    ).toBe(false);
  });

  it("returns false when quietEnd is missing", () => {
    expect(
      inQuietHours(
        { quietStart: "22:00", quietEnd: null, timezone: "UTC" },
        new Date("2026-04-21T23:00:00Z")
      )
    ).toBe(false);
  });

  it("returns false when start equals end (degenerate zero-width)", () => {
    expect(
      inQuietHours(
        { quietStart: "10:00", quietEnd: "10:00", timezone: "UTC" },
        new Date("2026-04-21T10:00:00Z")
      )
    ).toBe(false);
  });

  it("returns false for malformed time strings", () => {
    expect(
      inQuietHours(
        { quietStart: "25:00", quietEnd: "07:00", timezone: "UTC" },
        new Date("2026-04-21T23:00:00Z")
      )
    ).toBe(false);
  });
});

describe("inQuietHours — timezone awareness", () => {
  // 07:00 in New York (EDT, UTC-4) is 11:00 UTC. Quiet window ending at 07:00
  // local should not catch 11:00 UTC.
  it("respects recipient timezone for boundary check", () => {
    const prefs = { quietStart: "22:00", quietEnd: "07:00", timezone: "America/New_York" };
    // 08:00 New York local = 12:00 UTC → not quiet
    expect(inQuietHours(prefs, new Date("2026-04-21T12:00:00Z"))).toBe(false);
    // 23:00 New York local = 03:00 UTC (next day) → quiet
    expect(inQuietHours(prefs, new Date("2026-04-22T03:00:00Z"))).toBe(true);
  });
});
