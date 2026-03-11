// ── Bondarchuk Training Engine — Type Definitions ────────────────────
// All input/output types for the program generation engine.
// Consumes types from ../constants.ts and Prisma models.

import type {
  TrainingPhase,
  Classification,
  EventCode,
  GenderCode,
  ThrowEvent,
  Gender,
} from "../constants";

// ── Onboarding Data ─────────────────────────────────────────────────

/** Full wizard submission data collected during onboarding. */
export interface OnboardingData {
  // Step 1: Core identity
  event: ThrowEvent;
  gender: Gender;
  competitionPr: number; // meters, current best with competition implement

  // Step 2: Goal
  goalDistance: number; // meters
  targetDate: string; // YYYY-MM-DD

  // Step 3: Available implements
  implements: ImplementEntry[];

  // Step 4: Facilities
  facilities: FacilityConfig;

  // Step 5: Lifting PRs
  liftingPrs: LiftingPrs;

  // Step 6: Schedule
  schedule: SchedulePreferences;

  // Step 7: Experience
  experience: ExperienceData;

  // Step 8: Typing (optional — may already exist in ThrowsTyping)
  typing?: TypingSnapshot;
}

export interface ImplementEntry {
  weightKg: number;
  type: "hammer" | "weight" | "shot" | "disc" | "jav";
}

export interface FacilityConfig {
  hasCage: boolean;
  hasRing: boolean;
  hasFieldAccess: boolean;
  hasGym: boolean;
  gymEquipment: GymEquipment;
}

export interface GymEquipment {
  barbell: boolean;
  squatRack: boolean;
  platform: boolean;
  dumbbells: boolean;
  cables: boolean;
  medBalls: boolean;
  boxes: boolean;
  bands: boolean;
}

export interface LiftingPrs {
  squatKg?: number;
  benchKg?: number;
  cleanKg?: number;
  snatchKg?: number;
  ohpKg?: number;
  deadliftKg?: number;
  bodyWeightKg: number;
}

export interface SchedulePreferences {
  daysPerWeek: number; // 2-5
  sessionsPerDay: number; // 1-2
  includeLift: boolean;
}

export interface ExperienceData {
  yearsThowing: number;
  currentWeeklyVolume?: number; // approximate throws/week currently
  currentPhase?: TrainingPhase;
}

export interface TypingSnapshot {
  adaptationGroup: number; // 1=Fast, 2=Moderate, 3=Slow
  sessionsToForm: number;
  recommendedMethod: string;
  transferType?: string;
  selfFeelingAccuracy?: string;
  recoveryProfile?: string;
}

// ── Program Configuration ───────────────────────────────────────────

/** Full input to the program generation engine. */
export interface ProgramConfig {
  // Athlete identity
  athleteId: string;
  coachId?: string;
  event: ThrowEvent;
  eventCode: EventCode;
  gender: Gender;
  genderCode: GenderCode;

  // Current performance
  competitionPr: number;
  distanceBand: string;

  // Goal
  startDate: string;
  targetDate: string;
  goalDistance: number;

  // Schedule
  daysPerWeek: number;
  sessionsPerDay: number;
  includeLift: boolean;

  // Adaptation profile
  adaptationGroup: number;
  sessionsToForm: number;
  recommendedMethod: string;
  transferType?: string;
  recoveryProfile?: string;

  // Equipment
  availableImplements: ImplementEntry[];
  facilities: FacilityConfig;

  // Lifting
  liftingPrs: LiftingPrs;

  // Experience scaling
  yearsThowing: number;
  currentWeeklyVolume?: number;

  // Deficit analysis (from podium-profile.ts)
  deficitPrimary?: string;
  deficitSecondary?: string;

  // Gap 1: Evolving personal correlations
  personalCorrelations?: PersonalCorrelation[];

  // Gap 3: Adaptive waves — historical session data
  trainingHistory?: TrainingHistory;

  // Gap 4: Elite taper
  competitionImportance?: CompetitionImportance;
}

// ── Generated Output Types ──────────────────────────────────────────

/** Complete generated macrocycle ready for DB insertion. */
export interface GeneratedProgram {
  phases: GeneratedPhase[];
  totalWeeks: number;
  summary: ProgramSummary;
}

export interface ProgramSummary {
  totalPhases: number;
  totalSessions: number;
  estimatedTotalThrows: number;
  phaseBreakdown: Array<{
    phase: TrainingPhase;
    weeks: number;
    throwsPerWeek: number;
  }>;
}

export interface GeneratedPhase {
  phase: TrainingPhase;
  phaseOrder: number;
  startWeek: number;
  endWeek: number;
  durationWeeks: number;

  // Targets
  throwsPerWeekTarget: number;
  strengthDaysTarget: number;

  // Ratios
  cePercent: number;
  sdPercent: number;
  spPercent: number;
  gpPercent: number;

  // Implement distribution
  lightPercent: number;
  compPercent: number;
  heavyPercent: number;

  // Exercise complex
  exerciseComplex: ExerciseComplexEntry[];

  // Sessions
  weeks: GeneratedWeek[];
}

export interface GeneratedWeek {
  weekNumber: number;
  sessions: GeneratedSession[];
}

export interface GeneratedSession {
  weekNumber: number;
  dayOfWeek: number; // 1=Mon ... 7=Sun
  dayType: string; // A | B | C | D | E
  sessionType: string; // THROWS_ONLY | THROWS_LIFT | LIFT_ONLY | RECOVERY
  focusLabel: string;

  // Prescribed content
  throws: ThrowPrescription[];
  strength: StrengthPrescription[];
  warmup: WarmupPrescription[];

  // Targets
  totalThrowsTarget: number;
  estimatedDuration: number; // minutes
}

// ── Exercise Complex ────────────────────────────────────────────────

export interface ExerciseComplexEntry {
  name: string;
  classification: Classification;
  implementKg?: number;
  drillType?: string;
  correlationR?: number;
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
}

// ── Throw Prescription ──────────────────────────────────────────────

export interface ThrowPrescription {
  implement: string; // e.g. "7.26kg"
  implementKg: number;
  category: Classification;
  drillType: string; // FULL_THROW, STANDING, HALF_TURN, etc.
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  notes?: string;

  // Gap 2: PAP contrast interleaving
  papRestSeconds?: number;  // PAP-specific rest before this block
  contrastGroup?: number;   // group ID for UI display
}

// ── Strength Prescription ───────────────────────────────────────────

export interface StrengthPrescription {
  exerciseId: string;
  exerciseName: string;
  classification: Classification;
  sets: number;
  reps: number;
  intensityPercent?: number; // % of 1RM
  loadKg?: number; // calculated from % + PR
  restSeconds: number;
  notes?: string;
}

// ── Warmup Prescription ─────────────────────────────────────────────

export interface WarmupPrescription {
  name: string;
  duration?: number; // minutes
  notes?: string;
}

// ── Implement Distribution ──────────────────────────────────────────

export interface ImplementDistribution {
  light: ImplementAllocation[];
  comp: ImplementAllocation;
  heavy: ImplementAllocation[];
}

export interface ImplementAllocation {
  weightKg: number;
  label: string;
  throwsCount: number;
}

// ── Volume Targets ──────────────────────────────────────────────────

export interface VolumeTargets {
  throwsPerWeek: number;
  throwsPerSession: Record<string, number>; // keyed by day type (A, B, C, etc.)
  strengthDaysPerWeek: number;
}

// ── Exercise Selection ──────────────────────────────────────────────

export interface ExerciseSelectionParams {
  eventCode: EventCode;
  genderCode: GenderCode;
  distanceBand: string;
  availableImplements: ImplementEntry[];
  deficitPrimary?: string;
  deficitSecondary?: string;
  transferType?: string;
  previousComplexExercises?: string[]; // for freshness weighting on rotation
  personalCorrelations?: PersonalCorrelation[]; // Gap 1: blended correlations
}

export interface RankedExercise {
  name: string;
  classification: Classification;
  correlationR: number;
  implementKg?: number;
  drillType?: string;
  score: number; // weighted ranking score
}

// ── Adaptation Assessment ───────────────────────────────────────────

export type AdaptationRecommendation =
  | "CONTINUE"
  | "ROTATE_COMPLEX"
  | "REDUCE_VOLUME"
  | "INCREASE_VOLUME"
  | "DELOAD"
  | "ADVANCE_PHASE";

export type MarkTrend = "IMPROVING" | "PLATEAU" | "DECLINING";
export type StrengthTrend = "IMPROVING" | "STABLE" | "DECLINING";

export interface AdaptationCheckParams {
  programId: string;
  recentMarks: number[]; // last 10 competition-weight throws
  sessionsInComplex: number;
  sessionsToForm: number;
  enteredSportsForm: boolean;
  weeksSinceForm: number;
  recentReadinessScores: number[];
  recentSorenessScores: number[];
  strengthResults?: Array<{ exerciseName: string; weight: number; date: string }>;

  // Gap 5: Feedback loop enrichment
  historicalMarks?: number[];
  historicalSessionCounts?: number[];
  complexHistory?: ComplexHistory[];
  currentComplexExercises?: string[];
  prescribedThrowsTotal?: number;
  actualThrowsTotal?: number;
  rpeValues?: number[];
}

export interface AdaptationAssessment {
  recommendation: AdaptationRecommendation;
  reasoning: string;
  markTrend: MarkTrend;
  markSlope: number;
  averageMark: number;
  peakMark: number;
  avgReadiness: number;
  avgSoreness: number;
  strengthTrend?: StrengthTrend;
  adaptationProgress: {
    progress: number;
    phase: string;
    label: string;
  };

  // Gap 5: Feedback loop enrichment
  predictedMark?: number;
  actualVsPredicted?: number;
  complexEffectiveness?: number;
  deficitAttribution?: DeficitAttribution[];
  volumeAdjustment?: VolumeAdjustment;
  exerciseSwapSuggestions?: string[];
  feedbackConfidence?: number;
}

// ── Phase Generation Config ─────────────────────────────────────────

export interface PhaseGenConfig {
  phase: TrainingPhase;
  phaseOrder: number;
  startWeek: number;
  durationWeeks: number;
  programConfig: ProgramConfig;

  // Gap 3: Adaptive waves
  trainingHistory?: TrainingHistory;

  // Gap 4: Elite taper
  taperConfig?: TaperConfig;
}

// ── Week Generation Config ──────────────────────────────────────────

export interface WeekGenConfig {
  weekNumber: number;
  phase: TrainingPhase;
  daysPerWeek: number;
  sessionsPerDay: number;
  includeLift: boolean;
  throwsPerWeekTarget: number;
  strengthDaysTarget: number;
  exerciseComplex: ExerciseComplexEntry[];
  programConfig: ProgramConfig;
}

// ── Session Generation Config ───────────────────────────────────────

export interface SessionGenConfig {
  weekNumber: number;
  dayOfWeek: number;
  dayType: string;
  focus: string;
  throwsMin: number;
  throwsMax: number;
  strengthLevel: string; // "None" | "Light" | "Moderate" | "High"
  phase: TrainingPhase;
  exerciseComplex: ExerciseComplexEntry[];
  includeLift: boolean;
  programConfig: ProgramConfig;
}

// ── Complex Rotation ────────────────────────────────────────────────

export interface ComplexRotationParams {
  programConfig: ProgramConfig;
  currentComplex: ExerciseComplexEntry[];
  allPreviousComplexes: ExerciseComplexEntry[][];
  phase?: TrainingPhase;
}

// ── Onboarding Validation ───────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  warnings: string[];
}

// ── Gap 1: Personal Correlations ───────────────────────────────────

export interface PersonalCorrelation {
  exercise: string;
  personalR: number;
  dataPoints: number;
  confidence: number;
  populationR: number;
  blendedR: number;
}

export interface SessionExerciseRecord {
  sessionId: string;
  scheduledDate: string;
  exercises: string[];
  bestMark: number;
  throwCount: number;
}

// ── Gap 2: Contrast Patterns (PAP) ────────────────────────────────

export type ContrastPattern = "HEAVY_LIGHT" | "WAVE" | "COMP_HEAVY";

export interface ContrastConfig {
  pattern?: ContrastPattern;
  restMinutes?: number;
  minSetsPerImplement?: number;
}

// ── Gap 3: Adaptive Waves ─────────────────────────────────────────

export interface TrainingHistory {
  sessions: HistoricalSession[];
  adaptationGroup: number;
  phasesCompleted: number;
}

export interface HistoricalSession {
  date: string;
  totalThrows: number;
  bestMark?: number;
  rpe?: number;
  phase: TrainingPhase;
  weekInPhase: number;
}

export interface WeekMultiplier {
  weekIndex: number;
  volumeMultiplier: number;
  rationale: string;
}

// ── Gap 4: Elite Taper ────────────────────────────────────────────

export type CompetitionImportance = "A_MEET" | "B_MEET" | "C_MEET";

export interface TaperConfig {
  daysUntilMeet: number;
  adaptationGroup: number;
  competitionImportance: CompetitionImportance;
  peakVolume: number;
  totalTaperWeeks: number;
}

export interface TaperPlan {
  weekMultipliers: WeekMultiplier[];
  dailyMultipliers: number[];
  taperDuration: number;
  decayConstant: number;
  ceIntensityFloor: number;
  rationale: string;
}

// ── Gap 5: Feedback Loop ──────────────────────────────────────────

export type TrendDirection = "STABLE" | "RISING" | "FALLING";
export type DeficitType = "STRENGTH" | "TECHNICAL" | "RECOVERY" | "VOLUME" | "EXERCISE_SELECTION";

export interface FeedbackAnalysis {
  predictedMark: number;
  actualMark: number;
  deviation: number;
  markVariance: number;
  volumeAdherence: number;
  rpeTrend: TrendDirection;
  readinessTrend: TrendDirection;
  sorenessTrend: TrendDirection;
}

export interface ComplexHistory {
  complexId: string;
  exercises: string[];
  sessionsUsed: number;
  startMark: number;
  endMark: number;
  avgRpe: number;
  avgAdherence: number;
}

export interface ComplexScore {
  complexId: string;
  effectiveness: number;
  markImprovement: number;
  rank: number;
}

export interface VolumeAdjustment {
  multiplier: number; // 0.80-1.10
  reason: string;
  category: "OVERTRAINING" | "UNDERTRAINING" | "EFFICIENCY" | "DELOAD" | "MAINTAIN";
}

export interface DeficitAttribution {
  type: DeficitType;
  confidence: number;
  evidence: string;
  suggestedAction: string;
}

export interface LogFitResult {
  a: number;
  b: number;
  rSquared: number;
  predictedMark: number;
}

export interface FeedbackLoopResult {
  feedback: FeedbackAnalysis;
  complexScore?: ComplexScore[];
  volumeAdjustment: VolumeAdjustment;
  deficits: DeficitAttribution[];
}
