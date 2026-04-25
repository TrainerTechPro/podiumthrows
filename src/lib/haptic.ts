/**
 * Haptic feedback utility — feature-detects navigator.vibrate and no-ops
 * gracefully when unavailable (desktop, iOS Safari without user gesture, etc.).
 *
 * Vibration patterns are tuned for the athlete app, where moments of physical
 * feedback should map to the *meaning* of the event:
 *   - light: a tap landed (implement switch, mode toggle)
 *   - medium: a value committed (throw logged)
 *   - success: a save succeeded (form submit)
 *   - pr: a personal record was set (the moment of the product)
 *   - error: something failed (validation, network)
 *
 * Note: the Vibration API requires HTTPS in production; localhost is allowed.
 * iOS support is partial — Safari ignores navigator.vibrate entirely. Treat
 * haptics as additive sweetener, never as the only signal a user has.
 */

import { logger } from "@/lib/logger";

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch (err) {
    // ok: Safari throws NotAllowedError when vibrate() runs outside a user
    // gesture or while the page is hidden. Haptics are additive sweetener —
    // the user always also has visual + toast feedback — so a throw here
    // would crash the save flow for no real benefit. Breadcrumb only.
    logger.debug("haptic: vibrate threw, swallowed", {
      context: "ui",
      metadata: { reason: err instanceof Error ? err.message : "unknown" },
    });
  }
}

export const haptic = {
  light: () => vibrate(20),
  medium: () => vibrate(40),
  success: () => vibrate([30, 20, 30]),
  pr: () => vibrate([40, 30, 60, 30, 80]),
  error: () => vibrate([60, 40, 60]),
};
