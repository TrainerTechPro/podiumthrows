// ── Podium Throws Constants ─────────────────────────────────────────
// Complete rebuild from Bondarchuk's Transfer of Training (Volume IV).
// Contains ALL data, rules references, implement weights, distance bands,
// correlation coefficients, phase configs, strength DB, rest intervals,
// weekly templates, and taper protocol.

// ── Core Types ──────────────────────────────────────────────────────

export type ThrowEvent = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
export type EventCode = "SP" | "DT" | "HT" | "JT";
export type Gender = "MALE" | "FEMALE";
export type GenderCode = "M" | "F";
export type BlockType = "WARMUP" | "THROWING" | "STRENGTH" | "PLYOMETRIC" | "COOLDOWN" | "NOTES";
export type SessionType = "THROWS_ONLY" | "THROWS_LIFT" | "LIFT_ONLY" | "COMPETITION_SIM";
export type TrainingPhase = "ACCUMULATION" | "TRANSMUTATION" | "REALIZATION" | "COMPETITION" | "CLEANSE";
export type Classification = "CE" | "SD" | "SP" | "GP";

/** Bondarchuk's 5-category strength taxonomy. One exercise per category per session. */
export type BondarchukStrengthCategory = "OLYMPIC" | "LEG" | "ABDOMINAL" | "BACK" | "TWISTING";

/** Movement plane for GPE exercises. One exercise per plane in each complex. */
export type MovementPlane = "TRANSVERSE" | "FRONTAL" | "POSTERIOR" | "SAGITTAL";

export type TechniqueFocus = "FULL_THROW" | "STANDING" | "POWER_POSITION" | "HALF_TURN" | "GLIDE" | "SPIN" | "OTHER";
export type AssignmentStatus = "ASSIGNED" | "NOTIFIED" | "IN_PROGRESS" | "COMPLETED" | "PARTIAL" | "SKIPPED";
export type SelfFeeling = "GREAT" | "GOOD" | "AVERAGE" | "POOR" | "VERY_POOR";

// ── Event Code Mapping ──────────────────────────────────────────────

export const EVENT_CODE_MAP: Record<ThrowEvent, EventCode> = {
  SHOT_PUT: "SP",
  DISCUS: "DT",
  HAMMER: "HT",
  JAVELIN: "JT",
};

export const CODE_EVENT_MAP: Record<EventCode, ThrowEvent> = {
  SP: "SHOT_PUT",
  DT: "DISCUS",
  HT: "HAMMER",
  JT: "JAVELIN",
};

export const GENDER_CODE_MAP: Record<Gender, GenderCode> = {
  MALE: "M",
  FEMALE: "F",
};

// ── Event Metadata ──────────────────────────────────────────────────
// Design system: SP=#D4915A, DT=#6A9FD8, HT=#5BB88A, JT=#D46A6A

export const EVENTS: Record<ThrowEvent, { label: string; color: string; darkColor: string }> = {
  SHOT_PUT: { label: "Shot Put", color: "#D4915A", darkColor: "#D4915A" },
  DISCUS: { label: "Discus", color: "#6A9FD8", darkColor: "#6A9FD8" },
  HAMMER: { label: "Hammer Throw", color: "#5BB88A", darkColor: "#5BB88A" },
  JAVELIN: { label: "Javelin", color: "#D46A6A", darkColor: "#D46A6A" },
};

// ── Competition Weights ─────────────────────────────────────────────

export const COMPETITION_WEIGHTS: Record<EventCode, Record<GenderCode, number>> = {
  SP: { M: 7.26, F: 4 },
  DT: { M: 2, F: 1 },
  HT: { M: 7.26, F: 4 },
  JT: { M: 0.8, F: 0.6 },
};

// ── Distance Bands ──────────────────────────────────────────────────

export const DISTANCE_BANDS: Record<string, string[]> = {
  SP_M: ["14-15", "15-16", "16-17", "17-18", "18-19", "19-20", "20-21"],
  SP_F: ["13-14", "14-15", "15-16", "16-17", "17-18", "18-19", "19-20"],
  DT_M: ["40-45", "45-50", "50-55", "55-60", "60-65", "65-70"],
  DT_F: ["40-45", "45-50", "50-55", "55-60", "60-65", "65-70"],
  HT_M: ["45-50", "50-55", "55-60", "60-65", "65-70", "70-75", "75-80"],
  HT_F: ["45-50", "50-55", "55-60"],
  JT_M: ["50-55", "55-60", "60-65", "65-70", "70-75", "75-80", "80-85"],
  JT_F: ["40-45", "45-50", "50-55", "55-60", "60-65", "65-70"],
};

/** Classify an athlete's distance band from their PR */
export function classifyBand(event: EventCode, gender: GenderCode, pr: number): string | null {
  const key = `${event}_${gender}`;
  const bands = DISTANCE_BANDS[key];
  if (!bands) return null;
  for (const band of bands) {
    const [min, max] = band.split("-").map(Number);
    if (pr >= min && pr < max) return band;
  }
  // If above all bands, return the highest
  if (bands.length > 0) {
    const last = bands[bands.length - 1];
    const [, max] = last.split("-").map(Number);
    if (pr >= max) return last;
  }
  return null;
}

// ── Implement Types ─────────────────────────────────────────────────

export interface Implement {
  weight: string;
  weightKg: number;
  isCompetition: boolean;
  label: string;
}

// ── Implement Weight Tables by Level ────────────────────────────────

export interface LevelImplements {
  level: string;
  minMeters: number;
  maxMeters: number;
  light: number[];
  comp: number;
  heavy: number[];
  extraHeavy?: number[];
  weights?: number[];
}

export const IMPLEMENT_TABLES: Record<string, LevelImplements[]> = {
  SP_M: [
    { level: "14-16m", minMeters: 14, maxMeters: 16, light: [5], comp: 7.26, heavy: [8] },
    { level: "16-18m", minMeters: 16, maxMeters: 18, light: [5, 6], comp: 7.26, heavy: [8, 9] },
    { level: "18-20m", minMeters: 18, maxMeters: 20, light: [6], comp: 7.26, heavy: [8, 9], extraHeavy: [10] },
    { level: "20m+", minMeters: 20, maxMeters: 99, light: [6], comp: 7.26, heavy: [8, 9, 10], extraHeavy: [11] },
  ],
  SP_F: [
    { level: "13-15m", minMeters: 13, maxMeters: 15, light: [3], comp: 4, heavy: [5] },
    { level: "15-17m", minMeters: 15, maxMeters: 17, light: [3, 3.5], comp: 4, heavy: [5, 6] },
    { level: "17-19m", minMeters: 17, maxMeters: 19, light: [3.5], comp: 4, heavy: [5, 6] },
    { level: "19m+", minMeters: 19, maxMeters: 99, light: [3.5], comp: 4, heavy: [6, 7.26] },
  ],
  DT_M: [
    { level: "40-50m", minMeters: 40, maxMeters: 50, light: [1.5], comp: 2, heavy: [2.25] },
    { level: "50-60m", minMeters: 50, maxMeters: 60, light: [1.5, 1.75, 1.8], comp: 2, heavy: [2.25, 2.5] },
    { level: "60m+", minMeters: 60, maxMeters: 99, light: [1.75, 1.8], comp: 2, heavy: [2.5, 2.75] },
  ],
  DT_F: [
    { level: "40-50m", minMeters: 40, maxMeters: 50, light: [0.75], comp: 1, heavy: [1.25] },
    { level: "50-60m", minMeters: 50, maxMeters: 60, light: [0.75], comp: 1, heavy: [1.5, 1.75] },
    { level: "60m+", minMeters: 60, maxMeters: 99, light: [0.75], comp: 1, heavy: [1.5, 2] },
  ],
  HT_M: [
    { level: "45-55m", minMeters: 45, maxMeters: 55, light: [5], comp: 7.26, heavy: [8] },
    { level: "55-65m", minMeters: 55, maxMeters: 65, light: [5, 6], comp: 7.26, heavy: [8, 9], weights: [16] },
    { level: "65-75m", minMeters: 65, maxMeters: 75, light: [6], comp: 7.26, heavy: [8, 9, 10], weights: [16, 25] },
    { level: "75m+", minMeters: 75, maxMeters: 99, light: [6], comp: 7.26, heavy: [9, 10], weights: [16, 25] },
  ],
  HT_F: [
    { level: "45-50m", minMeters: 45, maxMeters: 50, light: [3], comp: 4, heavy: [5] },
    { level: "50-55m", minMeters: 50, maxMeters: 55, light: [3, 3.5], comp: 4, heavy: [5, 6], weights: [9] },
    { level: "55-60m+", minMeters: 55, maxMeters: 99, light: [3.5], comp: 4, heavy: [5, 6], weights: [9, 12] },
  ],
  JT_M: [
    { level: "50-60m", minMeters: 50, maxMeters: 60, light: [0.6], comp: 0.8, heavy: [0.9] },
    { level: "60-70m", minMeters: 60, maxMeters: 70, light: [0.6, 0.7], comp: 0.8, heavy: [0.9, 1] },
    { level: "70-80m", minMeters: 70, maxMeters: 80, light: [0.7], comp: 0.8, heavy: [0.9, 1] },
    { level: "80m+", minMeters: 80, maxMeters: 99, light: [0.7], comp: 0.8, heavy: [1, 1.1] },
  ],
  JT_F: [
    { level: "40-50m", minMeters: 40, maxMeters: 50, light: [0.4], comp: 0.6, heavy: [0.7] },
    { level: "50-60m", minMeters: 50, maxMeters: 60, light: [0.4, 0.5], comp: 0.6, heavy: [0.7, 0.8] },
    { level: "60m+", minMeters: 60, maxMeters: 99, light: [0.5], comp: 0.6, heavy: [0.8, 0.9] },
  ],
};

/** Get recommended implements for an athlete based on event, gender, and PR */
export function getImplementsForLevel(event: EventCode, gender: GenderCode, pr: number): LevelImplements | null {
  const key = `${event}_${gender}`;
  const table = IMPLEMENT_TABLES[key];
  if (!table) return null;
  for (const level of table) {
    if (pr >= level.minMeters && pr < level.maxMeters) return level;
  }
  // If above all levels, return the highest
  if (table.length > 0) return table[table.length - 1];
  return null;
}

// ── Flat implements list (backward-compatible) ──────────────────────

export const IMPLEMENTS: Record<ThrowEvent, Record<Gender, Implement[]>> = {
  SHOT_PUT: {
    MALE: [
      { weight: "11kg", weightKg: 11, isCompetition: false, label: "11kg (extra heavy)" },
      { weight: "10kg", weightKg: 10, isCompetition: false, label: "10kg (extra heavy)" },
      { weight: "9kg", weightKg: 9, isCompetition: false, label: "9kg (heavy)" },
      { weight: "8kg", weightKg: 8, isCompetition: false, label: "8kg (heavy)" },
      { weight: "7.26kg", weightKg: 7.26, isCompetition: true, label: "7.26kg (comp)" },
      { weight: "6kg", weightKg: 6, isCompetition: false, label: "6kg (light)" },
      { weight: "5kg", weightKg: 5, isCompetition: false, label: "5kg (light)" },
    ],
    FEMALE: [
      { weight: "7.26kg", weightKg: 7.26, isCompetition: false, label: "7.26kg (heavy)" },
      { weight: "6kg", weightKg: 6, isCompetition: false, label: "6kg (heavy)" },
      { weight: "5kg", weightKg: 5, isCompetition: false, label: "5kg (heavy)" },
      { weight: "4kg", weightKg: 4, isCompetition: true, label: "4kg (comp)" },
      { weight: "3.5kg", weightKg: 3.5, isCompetition: false, label: "3.5kg (light)" },
      { weight: "3kg", weightKg: 3, isCompetition: false, label: "3kg (light)" },
    ],
  },
  DISCUS: {
    MALE: [
      { weight: "2.75kg", weightKg: 2.75, isCompetition: false, label: "2.75kg (heavy)" },
      { weight: "2.5kg", weightKg: 2.5, isCompetition: false, label: "2.5kg (heavy)" },
      { weight: "2.25kg", weightKg: 2.25, isCompetition: false, label: "2.25kg (heavy)" },
      { weight: "2kg", weightKg: 2, isCompetition: true, label: "2kg (comp)" },
      { weight: "1.8kg", weightKg: 1.8, isCompetition: false, label: "1.8kg (light)" },
      { weight: "1.75kg", weightKg: 1.75, isCompetition: false, label: "1.75kg (light)" },
      { weight: "1.5kg", weightKg: 1.5, isCompetition: false, label: "1.5kg (light)" },
    ],
    FEMALE: [
      { weight: "2kg", weightKg: 2, isCompetition: false, label: "2kg (heavy)" },
      { weight: "1.75kg", weightKg: 1.75, isCompetition: false, label: "1.75kg (heavy)" },
      { weight: "1.5kg", weightKg: 1.5, isCompetition: false, label: "1.5kg (heavy)" },
      { weight: "1.25kg", weightKg: 1.25, isCompetition: false, label: "1.25kg (heavy)" },
      { weight: "1kg", weightKg: 1, isCompetition: true, label: "1kg (comp)" },
      { weight: "0.75kg", weightKg: 0.75, isCompetition: false, label: "0.75kg (light)" },
    ],
  },
  HAMMER: {
    MALE: [
      { weight: "10kg", weightKg: 10, isCompetition: false, label: "10kg (heavy)" },
      { weight: "9kg", weightKg: 9, isCompetition: false, label: "9kg (heavy)" },
      { weight: "8kg", weightKg: 8, isCompetition: false, label: "8kg (heavy)" },
      { weight: "7.26kg", weightKg: 7.26, isCompetition: true, label: "7.26kg (comp)" },
      { weight: "6kg", weightKg: 6, isCompetition: false, label: "6kg (light)" },
      { weight: "5kg", weightKg: 5, isCompetition: false, label: "5kg (light)" },
    ],
    FEMALE: [
      { weight: "6kg", weightKg: 6, isCompetition: false, label: "6kg (heavy)" },
      { weight: "5kg", weightKg: 5, isCompetition: false, label: "5kg (heavy)" },
      { weight: "4kg", weightKg: 4, isCompetition: true, label: "4kg (comp)" },
      { weight: "3.5kg", weightKg: 3.5, isCompetition: false, label: "3.5kg (light)" },
      { weight: "3kg", weightKg: 3, isCompetition: false, label: "3kg (light)" },
    ],
  },
  JAVELIN: {
    MALE: [
      { weight: "1100g", weightKg: 1.1, isCompetition: false, label: "1100g (heavy)" },
      { weight: "1000g", weightKg: 1, isCompetition: false, label: "1000g (heavy)" },
      { weight: "900g", weightKg: 0.9, isCompetition: false, label: "900g (heavy)" },
      { weight: "800g", weightKg: 0.8, isCompetition: true, label: "800g (comp)" },
      { weight: "700g", weightKg: 0.7, isCompetition: false, label: "700g (light)" },
      { weight: "600g", weightKg: 0.6, isCompetition: false, label: "600g (light)" },
    ],
    FEMALE: [
      { weight: "900g", weightKg: 0.9, isCompetition: false, label: "900g (heavy)" },
      { weight: "800g", weightKg: 0.8, isCompetition: false, label: "800g (heavy)" },
      { weight: "700g", weightKg: 0.7, isCompetition: false, label: "700g (heavy)" },
      { weight: "600g", weightKg: 0.6, isCompetition: true, label: "600g (comp)" },
      { weight: "500g", weightKg: 0.5, isCompetition: false, label: "500g (light)" },
      { weight: "400g", weightKg: 0.4, isCompetition: false, label: "400g (light)" },
    ],
  },
};

// ── Session & Block Type Metadata ───────────────────────────────────

export const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: "THROWS_ONLY", label: "Throws Only" },
  { value: "THROWS_LIFT", label: "Throws + Lift" },
  { value: "LIFT_ONLY", label: "Lift Only" },
  { value: "COMPETITION_SIM", label: "Competition Sim" },
];

export const TRAINING_PHASES: { value: TrainingPhase; label: string; description: string }[] = [
  { value: "ACCUMULATION", label: "Accumulation (GPP)", description: "Volume building, technical base (4-6 wk)" },
  { value: "TRANSMUTATION", label: "Transmutation (SPP)", description: "Transfer to competition (3-4 wk)" },
  { value: "REALIZATION", label: "Realization", description: "Peaking, intensity focus (2-3 wk)" },
  { value: "COMPETITION", label: "Competition", description: "Race-ready, taper (1-2 wk)" },
];

// ── Phase Configuration ─────────────────────────────────────────────

export const PHASE_RATIOS: Record<TrainingPhase, { CE: number; SD: number; SP: number; GP: number }> = {
  ACCUMULATION:  { CE: 15, SD: 35, SP: 30, GP: 20 },
  TRANSMUTATION: { CE: 25, SD: 40, SP: 25, GP: 10 },
  REALIZATION:   { CE: 40, SD: 35, SP: 20, GP: 5 },
  COMPETITION:   { CE: 50, SD: 30, SP: 15, GP: 5 },
  CLEANSE:       { CE: 50, SD: 20, SP: 30, GP: 0 },
};

export interface PhaseConfig {
  phase: TrainingPhase;
  cePercent: number;
  sdPercent: number;
  spPercent: number;
  gpPercent: number;
  throwsPerWeekMin: number;
  throwsPerWeekMax: number;
  strengthDaysMin: number;
  strengthDaysMax: number;
  durationWeeksMin: number;
  durationWeeksMax: number;
}

/**
 * Phase configs — throwsPerWeek ranges are now safety clamps only.
 * Primary volume is derived from sessions × THROWS_PER_SESSION (Bondarchuk principle).
 * Phase controls the CE/SD/SP *ratio* of those throws, not the total count.
 */
export const PHASE_CONFIGS: PhaseConfig[] = [
  { phase: "ACCUMULATION", cePercent: 15, sdPercent: 35, spPercent: 30, gpPercent: 20, throwsPerWeekMin: 40, throwsPerWeekMax: 200, strengthDaysMin: 3, strengthDaysMax: 4, durationWeeksMin: 4, durationWeeksMax: 6 },
  { phase: "TRANSMUTATION", cePercent: 25, sdPercent: 40, spPercent: 25, gpPercent: 10, throwsPerWeekMin: 40, throwsPerWeekMax: 200, strengthDaysMin: 2, strengthDaysMax: 3, durationWeeksMin: 3, durationWeeksMax: 4 },
  { phase: "REALIZATION", cePercent: 40, sdPercent: 35, spPercent: 20, gpPercent: 5, throwsPerWeekMin: 30, throwsPerWeekMax: 180, strengthDaysMin: 1, strengthDaysMax: 2, durationWeeksMin: 2, durationWeeksMax: 3 },
  { phase: "COMPETITION", cePercent: 50, sdPercent: 30, spPercent: 15, gpPercent: 5, throwsPerWeekMin: 20, throwsPerWeekMax: 150, strengthDaysMin: 0, strengthDaysMax: 1, durationWeeksMin: 1, durationWeeksMax: 2 },
  { phase: "CLEANSE", cePercent: 50, sdPercent: 20, spPercent: 30, gpPercent: 0, throwsPerWeekMin: 15, throwsPerWeekMax: 60, strengthDaysMin: 0, strengthDaysMax: 0, durationWeeksMin: 1, durationWeeksMax: 2 },
];

// ── Phase Distribution by Implement Weight ──────────────────────────

export interface PhaseImplementDist {
  phase: TrainingPhase;
  lightPercent: number;
  compPercent: number;
  heavyPercent: number;
}

export const PHASE_IMPLEMENT_DIST: PhaseImplementDist[] = [
  { phase: "ACCUMULATION", lightPercent: 25, compPercent: 40, heavyPercent: 35 },
  { phase: "TRANSMUTATION", lightPercent: 20, compPercent: 50, heavyPercent: 30 },
  { phase: "REALIZATION", lightPercent: 15, compPercent: 60, heavyPercent: 25 },
  { phase: "COMPETITION", lightPercent: 10, compPercent: 80, heavyPercent: 10 },
  { phase: "CLEANSE", lightPercent: 70, compPercent: 30, heavyPercent: 0 },
];

// ── Block Types ─────────────────────────────────────────────────────

export const BLOCK_TYPES: { value: BlockType; label: string; icon: string; color: string }[] = [
  { value: "WARMUP", label: "Warm-Up", icon: "🔥", color: "amber" },
  { value: "THROWING", label: "Throwing", icon: "🎯", color: "orange" },
  { value: "STRENGTH", label: "Strength", icon: "🏋️", color: "gray" },
  { value: "PLYOMETRIC", label: "Plyometric", icon: "⚡", color: "blue" },
  { value: "COOLDOWN", label: "Cool-Down", icon: "❄️", color: "cyan" },
  { value: "NOTES", label: "Notes", icon: "📝", color: "purple" },
];

export const TECHNIQUE_FOCUS: { value: TechniqueFocus; label: string }[] = [
  { value: "FULL_THROW", label: "Full Throw" },
  { value: "STANDING", label: "Standing" },
  { value: "POWER_POSITION", label: "Power Position" },
  { value: "HALF_TURN", label: "Half Turn" },
  { value: "GLIDE", label: "Glide" },
  { value: "SPIN", label: "Spin" },
  { value: "OTHER", label: "Other" },
];

// ── Classification Labels ───────────────────────────────────────────

export const CLASSIFICATIONS: Record<Classification, { label: string; description: string }> = {
  CE: { label: "Competitive Exercise", description: "Competition event at regulation weight" },
  SD: { label: "Specialized-Developmental", description: "Same event, different implements" },
  SP: { label: "Specialized-Preparatory", description: "Related movements (snatch, jumps, sprints)" },
  GP: { label: "General-Preparatory", description: "Non-specific conditioning (squat, bench, deadlift)" },
};

// ── Minimum Throw Counts (Volume IV) ────────────────────────────────

/**
 * Bondarchuk baseline throws per single training session.
 * Research: elite athletes average 15-30 throws/session (Bingisser ~160/week across 10 sessions).
 * 20 is the midpoint for non-elite athletes. Volume is derived from sessions × this constant.
 */
export const THROWS_PER_SESSION = 20;

export const MIN_THROWS: Record<ThrowEvent, number> = {
  SHOT_PUT: 12,
  DISCUS: 12,
  HAMMER: 8,
  JAVELIN: 12,
};

// ── Strength Exercise Database ──────────────────────────────────────

export interface StrengthExerciseDef {
  id: string;
  name: string;
  classification: Classification;
  muscle: string;
  bondarchukCategory?: BondarchukStrengthCategory;
  movementPlane?: MovementPlane;
}

export const STRENGTH_DB: StrengthExerciseDef[] = [
  // ── OLYMPIC (SP) — Global/Olympic lifts, 70-80% 1RM ──────────────
  { id: "snatch", name: "Barbell Snatch", classification: "SP", muscle: "Full Body", bondarchukCategory: "OLYMPIC" },
  { id: "power_clean", name: "Power Clean", classification: "SP", muscle: "Full Body", bondarchukCategory: "OLYMPIC" },
  { id: "clean_pull", name: "Clean Pull", classification: "SP", muscle: "Full Body", bondarchukCategory: "OLYMPIC" },
  { id: "power_snatch", name: "Power Snatch", classification: "SP", muscle: "Full Body", bondarchukCategory: "OLYMPIC" },
  { id: "jerk", name: "Jerk Behind Head", classification: "SP", muscle: "Full Body", bondarchukCategory: "OLYMPIC" },

  // ── LEG — Squat variants, step-ups, lunges ────────────────────────
  { id: "squat", name: "Back Squat", classification: "GP", muscle: "Legs", bondarchukCategory: "LEG" },
  { id: "front_squat", name: "Front Squat", classification: "GP", muscle: "Legs", bondarchukCategory: "LEG" },
  { id: "half_squat", name: "Half Squat", classification: "GP", muscle: "Legs", bondarchukCategory: "LEG" },
  { id: "step_up", name: "Step-Ups to Bench", classification: "GP", muscle: "Legs", bondarchukCategory: "LEG" },
  { id: "walking_lunge", name: "Walking Lunges", classification: "GP", muscle: "Legs", bondarchukCategory: "LEG" },

  // ── BACK (POSTERIOR plane) — RDL, good mornings, GHR ──────────────
  { id: "rdl", name: "Romanian Deadlift", classification: "GP", muscle: "Posterior", bondarchukCategory: "BACK", movementPlane: "POSTERIOR" },
  { id: "good_morning", name: "Good Mornings", classification: "GP", muscle: "Posterior", bondarchukCategory: "BACK", movementPlane: "POSTERIOR" },
  { id: "glute_ham", name: "Glute Ham Raise", classification: "GP", muscle: "Posterior", bondarchukCategory: "BACK", movementPlane: "POSTERIOR" },
  { id: "trap_deadlift", name: "Trap Bar Deadlift", classification: "GP", muscle: "Full Body", bondarchukCategory: "BACK", movementPlane: "POSTERIOR" },
  { id: "back_extension", name: "Back Extensions", classification: "GP", muscle: "Posterior", bondarchukCategory: "BACK", movementPlane: "POSTERIOR" },

  // ── TWISTING (TRANSVERSE plane) — Highest correlation to throwing ─
  { id: "med_ball_rot", name: "Med Ball Rotational", classification: "SP", muscle: "Core", bondarchukCategory: "TWISTING", movementPlane: "TRANSVERSE" },
  { id: "plate_twist", name: "Plate Twists", classification: "GP", muscle: "Core", bondarchukCategory: "TWISTING", movementPlane: "TRANSVERSE" },
  { id: "barbell_twist", name: "Barbell Twists", classification: "GP", muscle: "Core", bondarchukCategory: "TWISTING", movementPlane: "TRANSVERSE" },
  { id: "cable_woodchop", name: "Cable Woodchops", classification: "GP", muscle: "Core", bondarchukCategory: "TWISTING", movementPlane: "TRANSVERSE" },

  // ── ABDOMINAL (SAGITTAL plane) — Core / anterior chain ───────────
  { id: "ab_wheel", name: "Ab Wheel Rollout", classification: "GP", muscle: "Core", bondarchukCategory: "ABDOMINAL", movementPlane: "SAGITTAL" },
  { id: "v_ups", name: "V-Ups", classification: "GP", muscle: "Core", bondarchukCategory: "ABDOMINAL", movementPlane: "SAGITTAL" },
  { id: "hanging_leg_raise", name: "Hanging Leg Raises", classification: "GP", muscle: "Core", bondarchukCategory: "ABDOMINAL", movementPlane: "SAGITTAL" },
  { id: "plank", name: "Plank", classification: "GP", muscle: "Core", bondarchukCategory: "ABDOMINAL", movementPlane: "SAGITTAL" },

  // ── FRONTAL plane — Lateral movement GPE ──────────────────────────
  { id: "kb_windmill", name: "KB Windmill", classification: "GP", muscle: "Core", bondarchukCategory: "TWISTING", movementPlane: "FRONTAL" },
  { id: "lateral_raise", name: "Lateral Raises", classification: "GP", muscle: "Shoulders", movementPlane: "FRONTAL" },
  { id: "side_bend", name: "Barbell Side Bends", classification: "GP", muscle: "Core", movementPlane: "FRONTAL" },

  // ── Upper body pressing (no Bondarchuk category — builder only) ───
  { id: "bench", name: "Bench Press", classification: "GP", muscle: "Chest" },
  { id: "incline_bench", name: "Incline Bench", classification: "GP", muscle: "Chest" },
  { id: "ohp", name: "Overhead Press", classification: "GP", muscle: "Shoulders" },

  // ── SP plyometric / med ball (no strength category) ───────────────
  { id: "med_ball_oh", name: "Med Ball Overhead", classification: "SP", muscle: "Full Body" },
  { id: "box_jump", name: "Box Jumps", classification: "SP", muscle: "Legs" },
  { id: "plyo_bounds", name: "Bounding", classification: "SP", muscle: "Legs" },
];

// ── Rest Intervals (seconds) ────────────────────────────────────────

export interface RestIntervals {
  CE: number;
  SD: number;
  SP_power: number;
  SP_strength: number;
  GP: number;
}

export const REST_INTERVALS: Record<TrainingPhase, RestIntervals> = {
  ACCUMULATION:  { CE: 90, SD: 60, SP_power: 150, SP_strength: 210, GP: 90 },
  TRANSMUTATION: { CE: 150, SD: 90, SP_power: 150, SP_strength: 210, GP: 90 },
  REALIZATION:   { CE: 240, SD: 150, SP_power: 150, SP_strength: 210, GP: 90 },
  COMPETITION:   { CE: 300, SD: 180, SP_power: 120, SP_strength: 180, GP: 60 },
  CLEANSE:       { CE: 60, SD: 45, SP_power: 90, SP_strength: 90, GP: 45 },
};

// ── Weekly Schedule Templates ───────────────────────────────────────

export interface ScheduleDay {
  day: string;
  type: string;
  focus: string;
  throwsMin: number;
  throwsMax: number;
  strength: string;
}

export const WEEKLY_SCHEDULES: Record<TrainingPhase, ScheduleDay[]> = {
  ACCUMULATION: [
    { day: "Monday", type: "A", focus: "High Vol Technical", throwsMin: 60, throwsMax: 70, strength: "Moderate" },
    { day: "Tuesday", type: "B", focus: "Strength Emphasis", throwsMin: 25, throwsMax: 30, strength: "High" },
    { day: "Wednesday", type: "E", focus: "Recovery", throwsMin: 10, throwsMax: 15, strength: "None" },
    { day: "Thursday", type: "A", focus: "High Vol Technical", throwsMin: 60, throwsMax: 70, strength: "Moderate" },
    { day: "Friday", type: "B", focus: "Strength Emphasis", throwsMin: 25, throwsMax: 30, strength: "High" },
    { day: "Saturday", type: "E", focus: "Recovery", throwsMin: 10, throwsMax: 15, strength: "Light" },
  ],
  TRANSMUTATION: [
    { day: "Monday", type: "C", focus: "Speed/Technical", throwsMin: 40, throwsMax: 50, strength: "Low" },
    { day: "Tuesday", type: "B", focus: "Strength Emphasis", throwsMin: 25, throwsMax: 30, strength: "Moderate" },
    { day: "Wednesday", type: "E", focus: "Recovery", throwsMin: 10, throwsMax: 15, strength: "None" },
    { day: "Thursday", type: "C", focus: "Speed/Technical", throwsMin: 40, throwsMax: 50, strength: "Low" },
    { day: "Friday", type: "A", focus: "High Vol Technical", throwsMin: 50, throwsMax: 60, strength: "Moderate" },
  ],
  REALIZATION: [
    { day: "Monday", type: "C", focus: "Speed/Technical", throwsMin: 35, throwsMax: 40, strength: "Very Low" },
    { day: "Tuesday", type: "E", focus: "Recovery", throwsMin: 10, throwsMax: 15, strength: "None" },
    { day: "Thursday", type: "D", focus: "Competition Sim", throwsMin: 6, throwsMax: 10, strength: "None" },
  ],
  COMPETITION: [
    { day: "Monday", type: "C", focus: "Speed/Technical", throwsMin: 35, throwsMax: 40, strength: "Very Low" },
    { day: "Tuesday", type: "E", focus: "Recovery", throwsMin: 10, throwsMax: 15, strength: "None" },
    { day: "Thursday", type: "D", focus: "Competition Sim", throwsMin: 6, throwsMax: 10, strength: "None" },
    { day: "Saturday", type: "MEET", focus: "COMPETE", throwsMin: 6, throwsMax: 6, strength: "None" },
  ],
  CLEANSE: [
    { day: "Monday", type: "E", focus: "Cleanse — Light Circuit", throwsMin: 16, throwsMax: 20, strength: "None" },
    { day: "Wednesday", type: "E", focus: "Cleanse — Light Circuit", throwsMin: 16, throwsMax: 20, strength: "None" },
    { day: "Friday", type: "E", focus: "Cleanse — Light Circuit", throwsMin: 16, throwsMax: 20, strength: "None" },
  ],
};

// ── Taper Protocol ──────────────────────────────────────────────────

export interface TaperEntry {
  daysOut: number;
  volumeMultiplier: number;
}

export const TAPER_PROTOCOL: TaperEntry[] = [
  { daysOut: 7, volumeMultiplier: 0.70 },
  { daysOut: 5, volumeMultiplier: 0.50 },
  { daysOut: 3, volumeMultiplier: 0.30 },
  { daysOut: 1, volumeMultiplier: 0.10 },
];

// ── Self-Feeling Descriptions (Bondarchuk) ──────────────────────────

export const SELF_FEELING_OPTIONS: { value: SelfFeeling; label: string; rpeRange: string }[] = [
  { value: "GREAT", label: "Great", rpeRange: "8-10" },
  { value: "GOOD", label: "Good", rpeRange: "5-7" },
  { value: "AVERAGE", label: "Average", rpeRange: "5-7" },
  { value: "POOR", label: "Poor", rpeRange: "1-4" },
  { value: "VERY_POOR", label: "Very Poor", rpeRange: "1-4" },
];

// ── Multi-Event Utilities ───────────────────────────────────────────
// Sessions can target multiple events. The `event` field stores them
// as a comma-separated string (e.g. "SHOT_PUT,DISCUS").

/** Parse a (possibly comma-separated) event string into an array of ThrowEvent */
export function parseEvents(eventStr: string): ThrowEvent[] {
  if (!eventStr) return [];
  return eventStr.split(",").map((e) => e.trim()).filter(Boolean) as ThrowEvent[];
}

/** Serialise an array of ThrowEvent back to the DB string */
export function serializeEvents(events: ThrowEvent[]): string {
  return events.join(",");
}

/** Get the first (primary) event from the string */
export function primaryEvent(eventStr: string): ThrowEvent {
  return parseEvents(eventStr)[0] ?? "SHOT_PUT";
}

// ── Classification Display Colors ────────────────────────────────────
// Canonical Tailwind class strings for Bondarchuk exercise classifications.
// CE = Competitive Exercise (emerald), SD/SDE = Specific Developmental (blue),
// SP/SPE = Specific Preparatory (amber), GP/GPE = General Preparatory (purple)

export const CLASSIFICATION_COLORS: Record<string, string> = {
  CE: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  SD: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  SDE: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  SP: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  SPE: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  GP: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  GPE: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
};

export const CLASSIFICATION_COLOR_PARTS: Record<string, { bg: string; text: string }> = {
  CE: { bg: "bg-emerald-100 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400" },
  SD: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400" },
  SDE: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400" },
  SP: { bg: "bg-amber-100 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  SPE: { bg: "bg-amber-100 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400" },
  GP: { bg: "bg-purple-100 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-400" },
  GPE: { bg: "bg-purple-100 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-400" },
};
