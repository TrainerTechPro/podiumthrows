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

  // Gap 1: Personal correlations
  PersonalCorrelation,
  SessionExerciseRecord,

  // Gap 2: Contrast patterns
  ContrastPattern,
  ContrastConfig,

  // Gap 3: Adaptive waves
  TrainingHistory,
  HistoricalSession,
  WeekMultiplier,

  // Gap 4: Elite taper
  CompetitionImportance,
  TaperConfig,
  TaperPlan,

  // Gap 5: Feedback loop
  FeedbackAnalysis,
  ComplexHistory,
  ComplexScore,
  VolumeAdjustment,
  DeficitAttribution,
  LogFitResult,
  FeedbackLoopResult,
  TrendDirection,
  DeficitType,
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

// ── Gap 1: Personal Correlations ────────────────────────────────────
export {
  computePersonalCorrelations,
  confidenceRamp,
  blendCorrelation,
} from "./personal-correlations";

// ── Gap 2: Contrast Patterns (PAP) ─────────────────────────────────
export {
  applyContrastPattern,
  selectPattern,
} from "./contrast-patterns";

// ── Gap 3: Adaptive Waves ──────────────────────────────────────────
export {
  computeAdaptiveWave,
  detectSupercompensationTiming,
  estimateFatigueDecay,
} from "./adaptive-waves";

// ── Gap 4: Elite Taper ─────────────────────────────────────────────
export {
  computeTaper,
  computeTaperDayMultiplier,
} from "./elite-taper";

// ── Gap 5: Feedback Loop ───────────────────────────────────────────
export {
  fitLogarithmicGrowth,
  analyzeFeedback,
  scoreComplexEffectiveness,
  computeVolumeAdjustment,
  attributeDeficit,
  runFeedbackLoop,
  generateComplexId,
} from "./feedback-loop";
