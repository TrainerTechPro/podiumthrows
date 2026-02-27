// ── Training Engine — Public API ────────────────────────────────────
// Re-exports for the Bondarchuk training program generation engine.

// ── Types ────────────────────────────────────────────────────────────
export type {
  // Onboarding & config
  OnboardingData,
  ProgramConfig,
  ImplementEntry,
  FacilityConfig,
  GymEquipment,
  LiftingPrs,
  SchedulePreferences,
  ExperienceData,
  TypingSnapshot,

  // Generated structures
  GeneratedProgram,
  GeneratedPhase,
  GeneratedWeek,
  GeneratedSession,
  ProgramSummary,

  // Prescriptions
  ThrowPrescription,
  StrengthPrescription,
  WarmupPrescription,

  // Exercise complex
  ExerciseComplexEntry,
  ExerciseSelectionParams,
  RankedExercise,

  // Volume
  VolumeTargets,

  // Adaptation
  AdaptationCheckParams,
  AdaptationAssessment,
  AdaptationRecommendation,

  // Internal configs (useful for testing)
  PhaseGenConfig,
  WeekGenConfig,
  SessionGenConfig,
  ComplexRotationParams,
} from "./types";

// ── Core Generation ──────────────────────────────────────────────────
export { generateProgram } from "./generate-program";
export { generatePhase } from "./generate-phase";
export { generateWeek } from "./generate-week";
export { generateSession } from "./generate-session";

// ── Selection Engines ────────────────────────────────────────────────
export { selectExercises } from "./select-exercises";
export { selectImplements } from "./select-implements";
export { selectStrength } from "./select-strength";

// ── Volume Scaling ───────────────────────────────────────────────────
export {
  scaleVolume,
  reduceVolume,
  increaseVolume,
  deloadVolume,
} from "./scale-volume";

// ── Adaptation ──────────────────────────────────────────────────────
export { checkAdaptation } from "./adaptation-checker";
export {
  rotateComplex,
  complexesAreDifferent,
  complexDiff,
} from "./complex-manager";

// ── Validation ───────────────────────────────────────────────────────
export { validateOnboarding } from "./onboarding-validator";
