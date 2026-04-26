import type { ThrowEvent } from "@/lib/throws/constants";

/**
 * Onboarding state + reducer.
 *
 * Two modes: "signup" (5 visible steps) and "invite" (3 visible steps —
 * coach already filled events/gender via proxy invite, skip the profile
 * basics + PR capture, jump straight to the first log).
 *
 * `currentIndex` is the index INTO `visibleSteps`, not the step number.
 * Step numbers are user-facing; index is internal cursor.
 */

export type OnboardingMode = "signup" | "invite";

export type ClassStanding = "FR" | "SO" | "JR" | "SR" | "GRAD" | "PRO";
export type TurnDirection = "RIGHT" | "LEFT";

/** Training-level UI state. NOT persisted in v1 — no schema field yet. */
export type TrainingLevel = "STARTING" | "FEW_SEASONS" | "COMPETING" | "ELITE";

export type DistanceUnit = "m" | "ft";
export type WeightUnit = "kg" | "lb";

export const VISIBLE_STEPS_NORMAL = [1, 2, 3, 4, 5] as const;
export const VISIBLE_STEPS_INVITE = [1, 4, 5] as const;

export interface OnboardingState {
  mode: OnboardingMode;
  visibleSteps: ReadonlyArray<number>;
  currentIndex: number;

  // Step 1 — Event
  event: ThrowEvent | null;

  // Step 2 — Profile basics (all optional)
  classStanding: ClassStanding | null;
  trainingLevel: TrainingLevel | null;
  turnDirection: TurnDirection | null;

  // Step 3 — Recent PR (all optional)
  prImplementWeight: string; // string in form state to distinguish "" from "0"
  prImplementUnit: WeightUnit;
  prDistance: string;
  prDistanceUnit: DistanceUnit;
  prDate: string; // YYYY-MM-DD

  // Step 4 — First log (distance required if step is reached)
  firstThrowDistance: string;
  firstThrowDistanceUnit: DistanceUnit;
  firstThrowImplementWeight: string; // optional; defaults to PR weight or comp weight
  firstThrowImplementUnit: WeightUnit;
  firstThrowRpe: number;

  // Submission
  submitting: boolean;
  error: string | null;

  // Hydration: true once we've replaced initial state with prefill/draft
  hydrated: boolean;
}

export type OnboardingAction =
  | { type: "HYDRATE"; payload: Partial<OnboardingState> }
  | { type: "ADVANCE" }
  | { type: "BACK" }
  | { type: "GO_TO"; index: number }
  | { type: "SET_EVENT"; event: ThrowEvent }
  | { type: "SET_CLASS_STANDING"; value: ClassStanding | null }
  | { type: "SET_TRAINING_LEVEL"; value: TrainingLevel | null }
  | { type: "SET_TURN_DIRECTION"; value: TurnDirection | null }
  | {
      type: "SET_PR";
      patch: Partial<
        Pick<
          OnboardingState,
          "prImplementWeight" | "prImplementUnit" | "prDistance" | "prDistanceUnit" | "prDate"
        >
      >;
    }
  | {
      type: "SET_FIRST_THROW";
      patch: Partial<
        Pick<
          OnboardingState,
          | "firstThrowDistance"
          | "firstThrowDistanceUnit"
          | "firstThrowImplementWeight"
          | "firstThrowImplementUnit"
          | "firstThrowRpe"
        >
      >;
    }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "SUBMIT_RESET" };

export function initialState(mode: OnboardingMode): OnboardingState {
  return {
    mode,
    visibleSteps: mode === "invite" ? VISIBLE_STEPS_INVITE : VISIBLE_STEPS_NORMAL,
    currentIndex: 0,
    event: null,
    classStanding: null,
    trainingLevel: null,
    turnDirection: null,
    prImplementWeight: "",
    prImplementUnit: "kg",
    prDistance: "",
    prDistanceUnit: "m",
    prDate: new Date().toISOString().slice(0, 10),
    firstThrowDistance: "",
    firstThrowDistanceUnit: "m",
    firstThrowImplementWeight: "",
    firstThrowImplementUnit: "kg",
    firstThrowRpe: 6,
    submitting: false,
    error: null,
    hydrated: false,
  };
}

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction
): OnboardingState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.payload, hydrated: true };

    case "ADVANCE": {
      const next = state.currentIndex + 1;
      if (next >= state.visibleSteps.length) return state;
      return { ...state, currentIndex: next };
    }

    case "BACK": {
      const next = state.currentIndex - 1;
      if (next < 0) return state;
      return { ...state, currentIndex: next };
    }

    case "GO_TO": {
      if (action.index < 0 || action.index >= state.visibleSteps.length) return state;
      return { ...state, currentIndex: action.index };
    }

    case "SET_EVENT":
      return { ...state, event: action.event };

    case "SET_CLASS_STANDING":
      return { ...state, classStanding: action.value };

    case "SET_TRAINING_LEVEL":
      return { ...state, trainingLevel: action.value };

    case "SET_TURN_DIRECTION":
      return { ...state, turnDirection: action.value };

    case "SET_PR":
      return { ...state, ...action.patch };

    case "SET_FIRST_THROW":
      return { ...state, ...action.patch };

    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };

    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.error };

    case "SUBMIT_RESET":
      return { ...state, submitting: false, error: null };

    default:
      return state;
  }
}

/** Returns the user-facing step number (1-5) at the current cursor. */
export function currentStepNumber(state: OnboardingState): number {
  return state.visibleSteps[state.currentIndex];
}

/** Whether ADVANCE is permitted from the current step. */
export function canAdvance(state: OnboardingState): boolean {
  const step = currentStepNumber(state);
  switch (step) {
    case 1:
      return state.event !== null;
    case 2:
    case 3:
      return true; // all optional
    case 4: {
      // Distance required to log a throw
      const d = parseFloat(state.firstThrowDistance);
      return Number.isFinite(d) && d > 0;
    }
    case 5:
      return false; // terminal
    default:
      return false;
  }
}

/** Convert distance to meters for API submission. */
export function distanceToMeters(value: string, unit: DistanceUnit): number | null {
  if (value === "" || value == null) return null;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return unit === "ft" ? n * 0.3048 : n;
}

/** Convert weight to kg for API submission. */
export function weightToKg(value: string, unit: WeightUnit): number | null {
  if (value === "" || value == null) return null;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return unit === "lb" ? n * 0.453592 : n;
}
