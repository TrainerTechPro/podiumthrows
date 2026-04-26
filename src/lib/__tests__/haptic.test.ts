import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { haptic } from "@/lib/haptic";

// jsdom does not implement navigator.vibrate. We attach a spy when we want
// to observe calls, and reset to undefined to exercise the no-op fallback.
type NavWithVibrate = Navigator & { vibrate?: typeof navigator.vibrate };

function setVibrate(impl: typeof navigator.vibrate | undefined): void {
  Object.defineProperty(navigator, "vibrate", {
    configurable: true,
    writable: true,
    value: impl,
  });
}

describe("haptic", () => {
  let originalVibrate: typeof navigator.vibrate | undefined;

  beforeEach(() => {
    originalVibrate = (navigator as NavWithVibrate).vibrate;
  });

  afterEach(() => {
    setVibrate(originalVibrate);
  });

  it("calls navigator.vibrate with a single-pulse pattern for light()", () => {
    const spy = vi.fn().mockReturnValue(true);
    setVibrate(spy);

    haptic.light();

    expect(spy).toHaveBeenCalledWith(10);
  });

  it("calls navigator.vibrate with a multi-pulse streak pattern for streak()", () => {
    const spy = vi.fn().mockReturnValue(true);
    setVibrate(spy);

    haptic.streak();

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect((arg as number[]).length).toBeGreaterThan(1);
  });

  it("calls navigator.vibrate with a multi-pulse PR pattern for pr()", () => {
    const spy = vi.fn().mockReturnValue(true);
    setVibrate(spy);

    haptic.pr();

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(Array.isArray(arg)).toBe(true);
    expect((arg as number[]).length).toBeGreaterThan(1);
  });

  it("no-ops gracefully when navigator.vibrate is unavailable", () => {
    setVibrate(undefined);

    expect(() => haptic.light()).not.toThrow();
    expect(() => haptic.medium()).not.toThrow();
    expect(() => haptic.heavy()).not.toThrow();
    expect(() => haptic.success()).not.toThrow();
    expect(() => haptic.pr()).not.toThrow();
    expect(() => haptic.error()).not.toThrow();
    expect(() => haptic.streak()).not.toThrow();
  });

  it("swallows errors from navigator.vibrate (e.g. iOS gesture restrictions)", () => {
    const throwingSpy = vi.fn(() => {
      throw new Error("NotAllowedError");
    });
    setVibrate(throwingSpy);

    expect(() => haptic.pr()).not.toThrow();
    expect(throwingSpy).toHaveBeenCalled();
  });
});
