// ── Onboarding Validator ─────────────────────────────────────────────
// Validates all fields required before program generation.

import type { OnboardingData, ValidationResult } from "./types";
import { COMPETITION_WEIGHTS, EVENT_CODE_MAP } from "../constants";

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
    // Check for competition-weight implement (covers all 4 events)
    if (data.event && data.gender) {
      const eventCode = EVENT_CODE_MAP[data.event];
      const genderCode = data.gender === "MALE" ? "M" : "F";
      const compWeight =
        COMPETITION_WEIGHTS[eventCode as keyof typeof COMPETITION_WEIGHTS]?.[
          genderCode as "M" | "F"
        ];

      if (compWeight) {
        const hasCompetition = data.implements.some(
          (i) => i.weightKg === compWeight,
        );
        if (!hasCompetition) {
          warnings.push(
            `No competition-weight implement (${compWeight}kg) listed. Training will focus on available implements.`,
          );
        }
      }
    }

    // Check for ascending implement order (FORBIDDEN in Bondarchuk methodology)
    // Implements should be listed heaviest to lightest for proper descending sequencing
    const weights = data.implements.map((i) => i.weightKg).filter((w) => w > 0);
    if (weights.length >= 2) {
      for (let i = 0; i < weights.length - 1; i++) {
        if (weights[i] < weights[i + 1]) {
          warnings.push(
            "Implements should be listed heaviest to lightest for Bondarchuk sequencing. " +
            "Light-to-heavy ordering causes performance decreases of 2-4m.",
          );
          break;
        }
      }
    }
  }

  // Minimum program duration check
  if (data.targetDate) {
    const target = new Date(data.targetDate);
    const now = new Date();
    const weeksUntilTarget = (target.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000);
    if (weeksUntilTarget > 0 && weeksUntilTarget < 4) {
      warnings.push(
        "Target date is less than 4 weeks away. Minimum recommended program duration is 4 weeks for meaningful adaptation.",
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
    if (data.experience.yearsThrowing < 0) {
      errors.yearsThrowing = "Years throwing cannot be negative";
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
