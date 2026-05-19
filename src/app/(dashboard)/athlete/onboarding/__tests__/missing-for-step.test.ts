/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { initialState, missingForStep, type OnboardingState } from "../_state";

/**
 * canAdvance is well-defined per step in _state.ts. missingForStep must
 * mirror it: every step where canAdvance returns false (and the user can
 * actually see the disabled CTA) needs a specific actionable hint. Steps
 * where canAdvance is always true (2, 3) and the terminal step (5) return
 * null.
 */
describe("missingForStep — disabled-CTA hint copy", () => {
  function freshAthlete(): OnboardingState {
    // "signup" mode shows all 5 steps; "invite" skips a few. The hint
    // contract is the same either way.
    return initialState("signup");
  }

  it("step 1: prompts to pick an event when no event is selected", () => {
    const state = freshAthlete();
    expect(state.visibleSteps[state.currentIndex]).toBe(1);
    expect(missingForStep(state)).toBe("Pick an event to continue");
  });

  it("returns null when canAdvance is true (event picked on step 1)", () => {
    const state: OnboardingState = { ...freshAthlete(), event: "SHOT_PUT" };
    expect(missingForStep(state)).toBeNull();
  });

  it("returns null on step 2 (profile — always advanceable)", () => {
    const state: OnboardingState = {
      ...freshAthlete(),
      event: "SHOT_PUT",
      currentIndex: 1, // step 2
    };
    expect(missingForStep(state)).toBeNull();
  });

  it("step 4: prompts to enter distance when first-throw distance is empty", () => {
    const state: OnboardingState = {
      ...freshAthlete(),
      event: "SHOT_PUT",
      currentIndex: 3, // step 4
      firstThrowDistance: "",
    };
    expect(missingForStep(state)).toBe("Enter your throw distance to log it");
  });

  it("step 4: returns null once a valid distance is entered", () => {
    const state: OnboardingState = {
      ...freshAthlete(),
      event: "SHOT_PUT",
      currentIndex: 3,
      firstThrowDistance: "18.5",
    };
    expect(missingForStep(state)).toBeNull();
  });
});
