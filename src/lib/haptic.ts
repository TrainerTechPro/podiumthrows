/**
 * Haptic feedback utility — feature-detects navigator.vibrate and no-ops
 * gracefully when unavailable (desktop, iOS Safari without user gesture, etc.).
 *
 * Vibration patterns are tuned for the athlete app, where moments of physical
 * feedback should map to the *meaning* of the event:
 *   - light:   thumb landed on a tappable target (pull-to-refresh, toggle)
 *   - medium:  primary action engaged (Log button press, mode commit)
 *   - heavy:   irreversible action accepted (delete confirmation)
 *   - success: a save succeeded (form submit, check-in)
 *   - error:   something failed (validation, network)
 *   - pr:      a personal record was set (the moment of the product)
 *   - streak:  a streak day extended (dashboard mount, once per extension)
 *
 * Coach surfaces never call this lib through {@link useHaptic}; the wrapper
 * hook gates by athlete-shell. Direct calls from inside athlete-only files
 * are still permitted — they happen inside a shell already.
 *
 * Note: the Vibration API requires HTTPS in production; localhost is allowed.
 * iOS Safari ignores navigator.vibrate entirely. Treat haptics as additive
 * sweetener — the user always has visual + toast feedback.
 */

import { logger } from "@/lib/logger";

/** localStorage key for the user's haptics on/off preference. Default: ON. */
export const HAPTIC_PREF_KEY = "pt:haptics:enabled";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function preferenceEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(HAPTIC_PREF_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

/** True when the device exposes the Vibration API. */
export function isVibrationSupported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

/**
 * True when haptics will actually fire: device supports vibration, the user
 * has not turned the preference off, and they have not requested reduced
 * motion. Suitable for "Haptics are available on your device" copy.
 */
export function isEnabled(): boolean {
  return isVibrationSupported() && !prefersReducedMotion() && preferenceEnabled();
}

/** Persist the user's haptics preference. Synchronous local cache only —
 *  cross-device sync is the caller's job (POST to notification-preferences). */
export function setHapticPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HAPTIC_PREF_KEY, enabled ? "1" : "0");
  } catch (err) {
    // ok: best-effort write — Safari private mode and quota-exceeded both
    // throw here. Preference is also synced to AthleteProfile, so a failed
    // local write only affects this device until next mount.
    logger.debug("haptic: localStorage write failed", {
      context: "ui",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
}

function vibrate(pattern: number | number[]): void {
  if (!isVibrationSupported()) return;
  if (prefersReducedMotion()) return;
  if (!preferenceEnabled()) return;
  try {
    navigator.vibrate(pattern);
  } catch (err) {
    // Safari throws NotAllowedError when vibrate() runs outside a user
    // gesture or while the page is hidden. Haptics are additive sweetener,
    // so a throw here would crash the save flow for no real benefit.
    logger.debug("haptic: vibrate threw, swallowed", {
      context: "ui",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
}

export const haptic = {
  light: () => vibrate(10),
  medium: () => vibrate(25),
  heavy: () => vibrate(40),
  success: () => vibrate([20, 30, 20]),
  error: () => vibrate([50, 30, 50, 30, 50]),
  pr: () => vibrate([40, 20, 40, 20, 80]),
  streak: () => vibrate([30, 40, 30]),
};

export type Haptic = typeof haptic;
