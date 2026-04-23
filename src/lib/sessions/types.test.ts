import { describe, it, expect } from "vitest";
import {
  parseThrowsStatus,
  parseSessionView,
  isThrowsRecapStatus,
  type ThrowsAssignmentStatus,
} from "./types";

describe("parseThrowsStatus", () => {
  const valid: ThrowsAssignmentStatus[] = [
    "ASSIGNED",
    "NOTIFIED",
    "IN_PROGRESS",
    "COMPLETED",
    "PARTIAL",
    "SKIPPED",
  ];

  it.each(valid)("accepts %s", (status) => {
    expect(parseThrowsStatus(status)).toBe(status);
  });

  it("returns null for empty string", () => {
    expect(parseThrowsStatus("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseThrowsStatus(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseThrowsStatus(undefined)).toBeNull();
  });

  it("returns null for garbage values", () => {
    expect(parseThrowsStatus("completed")).toBeNull(); // case-sensitive
    expect(parseThrowsStatus("DONE")).toBeNull();
    expect(parseThrowsStatus("PENDING")).toBeNull();
    expect(parseThrowsStatus("' OR 1=1 --")).toBeNull();
  });

  it("isThrowsRecapStatus only matches terminal states", () => {
    expect(isThrowsRecapStatus("COMPLETED")).toBe(true);
    expect(isThrowsRecapStatus("PARTIAL")).toBe(true);
    expect(isThrowsRecapStatus("SKIPPED")).toBe(true);
    expect(isThrowsRecapStatus("ASSIGNED")).toBe(false);
    expect(isThrowsRecapStatus("NOTIFIED")).toBe(false);
    expect(isThrowsRecapStatus("IN_PROGRESS")).toBe(false);
    expect(isThrowsRecapStatus(null)).toBe(false);
  });
});

describe("parseSessionView", () => {
  it("accepts live", () => {
    expect(parseSessionView("live")).toBe("live");
  });

  it("accepts recap", () => {
    expect(parseSessionView("recap")).toBe("recap");
  });

  it("unwraps array values (Next.js searchParams shape)", () => {
    expect(parseSessionView(["live"])).toBe("live");
    expect(parseSessionView(["recap", "live"])).toBe("recap");
  });

  it("rejects everything else", () => {
    expect(parseSessionView("LIVE")).toBeNull();
    expect(parseSessionView("summary")).toBeNull();
    expect(parseSessionView("")).toBeNull();
    expect(parseSessionView(null)).toBeNull();
    expect(parseSessionView(undefined)).toBeNull();
    expect(parseSessionView([])).toBeNull();
    expect(parseSessionView(["garbage"])).toBeNull();
  });
});
