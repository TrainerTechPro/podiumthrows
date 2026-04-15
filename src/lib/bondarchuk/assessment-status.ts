// Bondarchuk assessment staleness status.
//
// Exercise recommendations depend on an athlete's type classification.
// Classifications decay as athletes adapt — stale assessments yield
// confident-looking but wrong recommendations ("garbage in, confident out").
//
// Pure function. No side effects. `now` is injectable for deterministic tests.

export type AssessmentTier = "fresh" | "aging" | "stale" | "expired" | "never";

export type AssessmentStatus = {
  tier: AssessmentTier;
  days: number;
  label: string;
  canAssign: boolean;
  canOverride: boolean;
};

const MS_PER_DAY = 86_400_000;

export function getAssessmentStatus(
  assessmentDate: Date | string | null,
  now: Date = new Date()
): AssessmentStatus {
  if (assessmentDate == null) {
    return {
      tier: "never",
      days: 0,
      label: "No assessment — assess athlete before programming",
      canAssign: false,
      canOverride: false,
    };
  }

  const ts =
    assessmentDate instanceof Date ? assessmentDate.getTime() : new Date(assessmentDate).getTime();

  const diffMs = now.getTime() - ts;
  // Clamp clock-skew futures to 0 — don't surface negative "days" to the UI.
  const days = Math.max(0, Math.floor(diffMs / MS_PER_DAY));

  if (days <= 30) {
    return {
      tier: "fresh",
      days,
      label: days === 0 ? "Assessed today" : `Fresh — assessed ${days}d ago`,
      canAssign: true,
      canOverride: false,
    };
  }

  if (days <= 60) {
    return {
      tier: "aging",
      days,
      label: `Consider re-test — ${days}d since last assessment`,
      canAssign: true,
      canOverride: false,
    };
  }

  if (days <= 90) {
    return {
      tier: "stale",
      days,
      label: `Stale — ${days}d since last assessment`,
      canAssign: true,
      canOverride: false,
    };
  }

  return {
    tier: "expired",
    days,
    label: `Assessment expired — ${days}d since last assessment`,
    canAssign: false,
    canOverride: true,
  };
}
