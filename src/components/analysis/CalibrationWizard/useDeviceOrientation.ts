"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DeviceOrientationSample } from "@/lib/contracts";

/**
 * Gyro feed for the wizard (F1). iOS requires a user-gesture permission
 * prompt (DeviceOrientationEvent.requestPermission); denial or absence of
 * the API degrades gracefully — the caller gets onStatus("denied"|
 * "unsupported") and falls back to manual-confirm. Never blocks the flow.
 */

type PermissionRequester = { requestPermission?: () => Promise<"granted" | "denied"> };

export function useDeviceOrientation(args: {
  active: boolean;
  onStatus: (status: "granted" | "denied" | "unsupported") => void;
  onSample: (sample: DeviceOrientationSample) => void;
}) {
  const { active, onStatus, onSample } = args;
  const listeningRef = useRef(false);

  const startListening = useCallback(() => {
    if (listeningRef.current) return;
    listeningRef.current = true;
    window.addEventListener("deviceorientation", (e: DeviceOrientationEvent) => {
      onSample({ alpha: e.alpha, beta: e.beta, gamma: e.gamma });
    });
  }, [onSample]);

  /** Must be called from a user gesture (button tap) for iOS. */
  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      onStatus("unsupported");
      return;
    }
    const ctor = DeviceOrientationEvent as unknown as PermissionRequester;
    if (typeof ctor.requestPermission === "function") {
      try {
        const result = await ctor.requestPermission();
        if (result === "granted") {
          onStatus("granted");
          startListening();
        } else {
          onStatus("denied");
        }
      } catch {
        // Safari throws when not called from a gesture, or user dismissed.
        onStatus("denied");
      }
    } else {
      // Android / desktop: no permission gate.
      onStatus("granted");
      startListening();
    }
  }, [onStatus, startListening]);

  useEffect(() => {
    if (!active) listeningRef.current = false;
  }, [active]);

  return { requestPermission };
}
