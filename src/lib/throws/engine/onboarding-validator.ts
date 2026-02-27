// ── Onboarding Validator ─────────────────────────────────────────────
// Validates all fields required before program generation.

import type { OnboardingData, ValidationResult } from "./types";

export function validateOnboarding(
  data: Partial<OnboardingData>,
): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  // Step 1: Core identity
  if (!data.event) errors.event = "Event is required";
  if (!data.gender) errors.gender = "Gender is required";
  if (!data.competitionPr || data.competitionPr <= 0) {
    errors.competitionPr = "Competition PR must be greater than 0";
  }

  // Step 2: Goal
  if (!data.goalDistance || data.goalDistance <= 0) {
    errors.goalDistance = "Goal distance must be greater than 0";
  }
  if (!data.targetDate) {
    errors.targetDate = "Target date is required";
  } else {
    const target = new Date(data.targetDate);
    const now = new Date();
    if (target <= now) {
      errors.targetDate = "Target date must be in the future";
    }
  }
  if (
    data.competitionPr &&
    data.goalDistance &&
    data.goalDistance <= data.competitionPr
  ) {
    errors.goalDistance = "Goal distance must be greater than current PR";
  }

  // Step 3: Implements
  if (!data.implements || data.implements.length === 0) {
    errors.implements = "At least one implement is required";
  } else {
    const hasCompetition = data.implements.some(
      (i) =>
        (data.event === "HAMMER" &&
          ((data.gender === "MALE" && i.weightKg === 7.26) ||
            (data.gender === "FEMALE" && i.weightKg === 4))) ||
        (data.event === "SHOT_PUT" &&
          ((data.gender === "MALE" && i.weightKg === 7.26) ||
            (data.gender === "FEMALE" && i.weightKg === 4))),
    );
    if (!hasCompetition) {
      warnings.push(
        "No competition-weight implement listed. Training will focus on available implements.",
      );
    }
  }

  // Step 4: Facilities
  if (!data.facilities) {
    errors.facilities = "Facility information is required";
  }

  // Step 5: Lifting PRs
  if (!data.liftingPrs) {
    errors.liftingPrs = "Lifting PRs are required";
  } else {
    if (!data.liftingPrs.bodyWeightKg || data.liftingPrs.bodyWeightKg <= 0) {
      errors.bodyWeightKg = "Body weight is required";
    }
    // Individual lifts are optional but we want at least one
    const hasAnyLift =
      (data.liftingPrs.squatKg && data.liftingPrs.squatKg > 0) ||
      (data.liftingPrs.benchKg && data.liftingPrs.benchKg > 0) ||
      (data.liftingPrs.cleanKg && data.liftingPrs.cleanKg > 0) ||
      (data.liftingPrs.snatchKg && data.liftingPrs.snatchKg > 0);
    if (!hasAnyLift) {
      warnings.push(
        "No lifting PRs provided. Strength programming will use conservative estimates.",
      );
    }
  }

  // Step 6: Schedule
  if (!data.schedule) {
    errors.schedule = "Schedule preferences are required";
  } else {
    if (data.schedule.daysPerWeek < 2 || data.schedule.daysPerWeek > 5) {
      errors.daysPerWeek = "Days per week must be between 2 and 5";
    }
    if (data.schedule.sessionsPerDay < 1 || data.schedule.sessionsPerDay > 2) {
      errors.sessionsPerDay = "Sessions per day must be 1 or 2";
    }
  }

  // Step 7: Experience
  if (!data.experience) {
    errors.experience = "Experience data is required";
  } else {
    if (data.experience.yearsThowing < 0) {
      errors.yearsThowing = "Years throwing cannot be negative";
    }
  }

  // Step 8: Typing (optional but recommended)
  if (!data.typing) {
    warnings.push(
      "No typing data provided. Default moderate adapter profile will be used.",
    );
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}
