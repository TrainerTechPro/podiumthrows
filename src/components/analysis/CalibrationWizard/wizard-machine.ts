import type { AnalysisEvent, DeviceOrientationSample, RingEllipse } from "@/lib/contracts";

/**
 * F1 wizard state machine — a pure reducer so every transition is unit-
 * testable without a browser. The component layer feeds it events from
 * getUserMedia / DeviceOrientation / Web Speech; it never reaches into them.
 *
 * Flow: event_select → position → align (MISALIGNED/CLOSE/LOCKED)
 *       → captured → saving → done; gyro denial degrades to manual confirm,
 *       it never blocks (F1 acceptance).
 */

export type AlignmentZone = "MISALIGNED" | "CLOSE" | "LOCKED";
export type GyroStatus = "unknown" | "granted" | "denied" | "unsupported";

export interface EventCaptureConfig {
  /** Camera pitch band, degrees down from horizontal. */
  pitchBand: [number, number];
  rollToleranceDeg: number;
  minTripodDistanceM: number;
  positionLabel: string;
}

/**
 * Position defaults per PRD F1. minTripodDistanceM = 5 is measured, not
 * styled: the affine calibration model crosses the 2% scale-error gate at
 * ~5 m (see calibration/__tests__/homography.test.ts).
 */
export const EVENT_CAPTURE_CONFIG: Record<string, EventCaptureConfig> = {
  SHOT_PUT: {
    pitchBand: [8, 20],
    rollToleranceDeg: 1.5,
    minTripodDistanceM: 5,
    positionLabel: "Rear-45° to the circle (side-on for glide)",
  },
  HAMMER: {
    pitchBand: [10, 25],
    rollToleranceDeg: 1.5,
    minTripodDistanceM: 5,
    positionLabel: "Behind the cage, elevated",
  },
  DISCUS: {
    pitchBand: [8, 20],
    rollToleranceDeg: 1.5,
    minTripodDistanceM: 5,
    positionLabel: "Rear-45° to the circle",
  },
};

/** LOCKED must hold this long before capture fires (debounce wobble). */
export const LOCK_HOLD_MS = 1000;

export interface WizardState {
  step: "event_select" | "position" | "align" | "captured" | "saving" | "done" | "error";
  event: AnalysisEvent | null;
  gyro: GyroStatus;
  alignment: AlignmentZone;
  lockedSinceMs: number | null;
  lastSample: DeviceOrientationSample | null;
  ringEllipse: RingEllipse | null;
  calibrationSessionId: string | null;
  errorMessage: string | null;
}

export const initialWizardState: WizardState = {
  step: "event_select",
  event: null,
  gyro: "unknown",
  alignment: "MISALIGNED",
  lockedSinceMs: null,
  lastSample: null,
  ringEllipse: null,
  calibrationSessionId: null,
  errorMessage: null,
};

export type WizardEvent =
  | { type: "SELECT_EVENT"; event: AnalysisEvent }
  | { type: "CONFIRM_POSITION" }
  | { type: "GYRO_GRANTED" }
  | { type: "GYRO_DENIED" }
  | { type: "GYRO_UNSUPPORTED" }
  | { type: "ORIENTATION_SAMPLE"; sample: DeviceOrientationSample; nowMs: number }
  | { type: "MANUAL_LEVEL_CONFIRM"; nowMs: number }
  | { type: "LOCK_HOLD_ELAPSED"; nowMs: number; ringEllipse: RingEllipse }
  | { type: "SAVE" }
  | { type: "SAVE_OK"; calibrationSessionId: string }
  | { type: "SAVE_FAILED"; message: string }
  | { type: "RETRY" }
  | { type: "RESET" };

/**
 * Classify a gyro sample against the event's tolerance (pure).
 * beta ≈ device pitch, gamma ≈ roll in the typical landscape tripod mount.
 * pitchDown = 90 − beta for a phone facing the ring.
 */
export function classifyAlignment(
  sample: DeviceOrientationSample,
  config: EventCaptureConfig
): AlignmentZone {
  if (sample.beta === null || sample.gamma === null) return "MISALIGNED";
  const roll = sample.gamma;
  const pitchDown = 90 - sample.beta;
  const [pitchLo, pitchHi] = config.pitchBand;

  const rollOk = Math.abs(roll) <= config.rollToleranceDeg;
  const pitchOk = pitchDown >= pitchLo && pitchDown <= pitchHi;
  if (rollOk && pitchOk) return "LOCKED";

  const rollClose = Math.abs(roll) <= config.rollToleranceDeg * 2;
  const pitchMid = (pitchLo + pitchHi) / 2;
  const pitchHalf = (pitchHi - pitchLo) / 2;
  const pitchClose = Math.abs(pitchDown - pitchMid) <= pitchHalf * 2;
  return rollClose && pitchClose ? "CLOSE" : "MISALIGNED";
}

export function wizardReducer(state: WizardState, event: WizardEvent): WizardState {
  switch (event.type) {
    case "SELECT_EVENT":
      if (state.step !== "event_select") return state;
      return { ...state, step: "position", event: event.event };

    case "CONFIRM_POSITION":
      if (state.step !== "position") return state;
      return { ...state, step: "align" };

    case "GYRO_GRANTED":
      return state.step === "align" ? { ...state, gyro: "granted" } : state;
    case "GYRO_DENIED":
      // F1: denial degrades to visual-only alignment — never blocks.
      return state.step === "align" ? { ...state, gyro: "denied" } : state;
    case "GYRO_UNSUPPORTED":
      return state.step === "align" ? { ...state, gyro: "unsupported" } : state;

    case "ORIENTATION_SAMPLE": {
      if (state.step !== "align" || state.gyro !== "granted" || !state.event) return state;
      // All-null sample = "no reading" (browsers emit these on listener
      // attach and when sensors throttle), NOT "misaligned" — it must never
      // destroy a held lock. Verified live: headless Chromium fires one.
      if (event.sample.beta === null && event.sample.gamma === null) return state;
      const config = EVENT_CAPTURE_CONFIG[state.event];
      if (!config) return state;
      const alignment = classifyAlignment(event.sample, config);
      return {
        ...state,
        alignment,
        lastSample: event.sample,
        lockedSinceMs:
          alignment === "LOCKED"
            ? (state.lockedSinceMs ?? event.nowMs)
            : null,
      };
    }

    case "MANUAL_LEVEL_CONFIRM":
      // Gyro-denied/unsupported path: the user vouches for level by eye.
      if (state.step !== "align" || state.gyro === "granted") return state;
      return {
        ...state,
        alignment: "LOCKED",
        lockedSinceMs: event.nowMs,
        lastSample: null,
      };

    case "LOCK_HOLD_ELAPSED": {
      if (state.step !== "align" || state.alignment !== "LOCKED") return state;
      if (state.lockedSinceMs === null || event.nowMs - state.lockedSinceMs < LOCK_HOLD_MS) {
        return state;
      }
      return { ...state, step: "captured", ringEllipse: event.ringEllipse };
    }

    case "SAVE":
      if (state.step !== "captured") return state;
      return { ...state, step: "saving" };

    case "SAVE_OK":
      if (state.step !== "saving") return state;
      return { ...state, step: "done", calibrationSessionId: event.calibrationSessionId };

    case "SAVE_FAILED":
      if (state.step !== "saving") return state;
      return { ...state, step: "error", errorMessage: event.message };

    case "RETRY":
      if (state.step !== "error") return state;
      return { ...state, step: "captured", errorMessage: null };

    case "RESET":
      return initialWizardState;
  }
}
