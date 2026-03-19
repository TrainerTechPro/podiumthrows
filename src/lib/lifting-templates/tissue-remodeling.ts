// Tissue Remodeling Block — Bondarchuk-aligned lifting program template
// 6-week preparatory block focusing on tissue adaptation through progressive
// volume reduction (1x20 → 1x15 → 1x10) with isometric hold integration.

// ---------------------------------------------------------------------------
// Template shape — matches the POST /api/lifting/programs endpoint payload
// ---------------------------------------------------------------------------

export interface LiftingProgramTemplate {
  name: string;
  goals: string[];
  workoutsPerWeek: number;
  totalWeeks: number;
  rpeTargets: string[];
  phases: {
    name: string;
    method: string;
    startWeek: number;
    endWeek: number;
    order: number;
    exercises: {
      name: string;
      order: number;
      prescribedSets: number;
      prescribedReps: string | null;
      prescribedDuration: string | null;
      prescribedLoad: string | null;
      isIsometric: boolean;
      durationProgression: Record<number, string[]> | null; // keyed by weekNumber
      setsProgression: Record<number, string[]> | null; // keyed by weekNumber
    }[];
  }[];
}

// ---------------------------------------------------------------------------
// Helper — builds a simple (non-isometric) exercise entry
// ---------------------------------------------------------------------------

function exercise(
  name: string,
  order: number,
  prescribedReps: string,
): LiftingProgramTemplate["phases"][number]["exercises"][number] {
  return {
    name,
    order,
    prescribedSets: 1,
    prescribedReps,
    prescribedDuration: null,
    prescribedLoad: null,
    isIsometric: false,
    durationProgression: null,
    setsProgression: null,
  };
}

// ---------------------------------------------------------------------------
// Helper — builds an isometric hold entry
// ---------------------------------------------------------------------------

function isoHold(
  name: string,
  order: number,
  prescribedDuration: string,
  durationProgression: Record<number, string[]>,
  setsProgression: Record<number, string[]> | null,
): LiftingProgramTemplate["phases"][number]["exercises"][number] {
  return {
    name,
    order,
    prescribedSets: 1,
    prescribedReps: null,
    prescribedDuration,
    prescribedLoad: "bodyweight",
    isIsometric: true,
    durationProgression,
    setsProgression,
  };
}

// ---------------------------------------------------------------------------
// Phase 1 — 1x20  (Weeks 1-2)
// ---------------------------------------------------------------------------

const PHASE_1_EXERCISES: LiftingProgramTemplate["phases"][number]["exercises"] =
  [
    "DB Goblet Squat",
    "Hip Abduction",
    "Hip Adduction",
    "Push Up",
    "Inverted Row",
    "Band Knee Drive",
    "1-Arm DB Overhead Press",
    "Lat Pulldown",
    "Back Raise",
    "Sit-Up",
    "Back Raise w/ Twist",
    "DB Lateral Raise",
    "DB Front Raise",
    "DB Rear Delt Raise",
    "Russian Twist",
    "Reverse Sit-Up",
    "Double-Leg Sissy Squat",
    "Band Hamstring Curl",
    "DB Bicep Curl",
    "Tricep Pushdown",
    "EZ-Bar Reverse Curls",
    "Single-Leg Calf Raise",
    "Anterior Tibialis Raise",
    "DB Supination & Pronation",
    "EZ-Bar Wrist Flexion",
    "EZ-Bar Wrist Extension",
    "Plate Pinch Drop + Catch",
    "Belly Breathing",
  ].map((name, i) => exercise(name, i + 1, "20"));

// ---------------------------------------------------------------------------
// Phase 2 — 1x15  (Weeks 3-4)
// ---------------------------------------------------------------------------

const PHASE_2_DURATION_PROGRESSION: Record<number, string[]> = {
  3: ["30s", "45s", "45s", "60s"],
  4: ["45s", "60s", "45s", "60s"],
};

const PHASE_2_MAIN: LiftingProgramTemplate["phases"][number]["exercises"] = [
  "Front Squat",
  "Hip Abduction",
  "Hip Adduction",
  "DB Bench Press",
  "1-Arm DB Row",
  "Barbell RDL",
  "Standing Band Knee Drive",
  "Single-Leg Hip Thrust",
  "Kneeling 1-Arm Landmine Press",
  "Pull Up",
  "Glute Ham Raise",
  "Hanging Knee Raise",
].map((name, i) => exercise(name, i + 1, "15"));

const PHASE_2_ISOS: LiftingProgramTemplate["phases"][number]["exercises"] = [
  { name: "Half Squat ISO", order: 13 },
  { name: "Push Up ISO", order: 14 },
  { name: "Split Squat Right ISO", order: 15 },
  { name: "Split Squat Left ISO", order: 16 },
  { name: "Pull Up ISO", order: 17 },
  { name: "Back Extension ISO", order: 18 },
].map(({ name, order }) =>
  isoHold(name, order, "30s", PHASE_2_DURATION_PROGRESSION, null),
);

// ---------------------------------------------------------------------------
// Phase 3 — 1x10  (Weeks 5-6)
// ---------------------------------------------------------------------------

const PHASE_3_DURATION_PROGRESSION: Record<number, string[]> = {
  5: ["75s", "90s", "90s", "90s"],
  6: ["90s", "90s", "90s", "90s"],
};

const PHASE_3_SETS_PROGRESSION: Record<number, string[]> = {
  5: ["1", "1", "1", "2"],
  6: ["1", "2", "1", "2"],
};

const PHASE_3_MAIN: LiftingProgramTemplate["phases"][number]["exercises"] = [
  "Back Squat",
  "DB Goblet Lateral Lunge",
  "Barbell Bench Press",
  "Barbell Row",
  "Barbell Deadlift",
  "DB Bulgarian Split Squat",
  "Barbell Military Press",
  "Pull Up",
  "Yessis Glute Ham Raise",
  "Russian Twist",
].map((name, i) => exercise(name, i + 1, "10"));

const PHASE_3_ISOS: LiftingProgramTemplate["phases"][number]["exercises"] = [
  { name: "Half Squat ISO", order: 11 },
  { name: "Push Up ISO", order: 12 },
  { name: "Split Squat Right ISO", order: 13 },
  { name: "Split Squat Left ISO", order: 14 },
  { name: "Pull Up ISO", order: 15 },
  { name: "Back Extension ISO", order: 16 },
].map(({ name, order }) =>
  isoHold(
    name,
    order,
    "75s",
    PHASE_3_DURATION_PROGRESSION,
    PHASE_3_SETS_PROGRESSION,
  ),
);

// ---------------------------------------------------------------------------
// Full template export
// ---------------------------------------------------------------------------

export const TISSUE_REMODELING_TEMPLATE: LiftingProgramTemplate = {
  name: "Tissue Remodeling Block",
  goals: [
    "Connective tissue adaptation",
    "Joint integrity",
    "Movement pattern foundation",
    "Isometric strength base",
  ],
  workoutsPerWeek: 4,
  totalWeeks: 6,
  rpeTargets: ["5-6", "6-7", "7-8"],
  phases: [
    {
      name: "1x20 Phase",
      method: "High-rep tissue adaptation",
      startWeek: 1,
      endWeek: 2,
      order: 1,
      exercises: PHASE_1_EXERCISES,
    },
    {
      name: "1x15 Phase",
      method: "Moderate-rep with isometric introduction",
      startWeek: 3,
      endWeek: 4,
      order: 2,
      exercises: [...PHASE_2_MAIN, ...PHASE_2_ISOS],
    },
    {
      name: "1x10 Phase",
      method: "Strength-rep with progressive isometrics",
      startWeek: 5,
      endWeek: 6,
      order: 3,
      exercises: [...PHASE_3_MAIN, ...PHASE_3_ISOS],
    },
  ],
};
