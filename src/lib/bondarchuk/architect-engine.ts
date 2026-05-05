/**
 * Bondarchuk Architect Engine
 *
 * Analyzes an athlete's profile against Bondarchuk methodology to produce:
 *   1. Distance band classification
 *   2. Deficit analysis (strength benchmarks vs KPIs)
 *   3. Method selection (Complex vs Variation based on days to championship)
 *   4. Session structure recommendation (implement sequencing per Vol IV)
 *
 * Pure functions. No side effects. No framework imports.
 */

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type EventType = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";
export type Gender = "MALE" | "FEMALE";
export type TrainingPhase = "ACCUMULATION" | "CONVERSION" | "REALIZATION";
export type TrainingMethod = "COMPLEX" | "VARIATION";

export type DistanceBand = {
  label: string;
  min: number;
  max: number | null;
};

export type StrengthBenchmark = {
  lift: string;
  standard: number;
  unit: string;
  current: number | null;
  status: "above" | "at" | "below" | "unknown";
  deficit: number | null;
};

export type DeficitProfile = {
  type: "balanced" | "force-dominant" | "speed-dominant" | "under-developed";
  label: string;
  description: string;
  strengthBenchmarks: StrengthBenchmark[];
  primaryDeficit: string | null;
};

export type ImplementRecommendation = {
  weight: string;
  role: "heavy" | "competition" | "light";
  throwCount: string;
  intensityRange: string;
  position: number;
};

export type SessionBlock = {
  type: "THROWING" | "STRENGTH";
  label: string;
  position: number;
  implements?: ImplementRecommendation[];
  exercises?: string[];
  notes?: string;
};

export type SessionStructure = {
  template: string;
  description: string;
  blocks: SessionBlock[];
  totalThrows: string;
  weeklyVolume: string;
  restIntervals: { throws: string; strength: string };
};

export type PhaseConflict = {
  type: "warning" | "error";
  message: string;
};

export type ArchitectAnalysis = {
  athlete: {
    name: string;
    event: EventType;
    gender: Gender;
    pr: number | null;
    distanceBand: DistanceBand;
  };
  context: {
    daysToChampionship: number;
    trainingPhase: TrainingPhase;
    phaseConflicts: PhaseConflict[];
  };
  deficitProfile: DeficitProfile;
  method: {
    selected: TrainingMethod;
    rationale: string;
    daysThreshold: number;
  };
  sessionStructure: SessionStructure;
  weeklyDistribution: {
    ce: string;
    sde: string;
    spe: string;
    gpe: string;
  };
};

/* ─── Distance Bands ─────────────────────────────────────────────────── */

const DISTANCE_BANDS: Record<EventType, Record<Gender, DistanceBand[]>> = {
  SHOT_PUT: {
    MALE: [
      { label: "14-16m", min: 14, max: 16 },
      { label: "16-18m", min: 16, max: 18 },
      { label: "18-20m", min: 18, max: 20 },
      { label: "20m+", min: 20, max: null },
    ],
    FEMALE: [
      { label: "13-15m", min: 13, max: 15 },
      { label: "15-17m", min: 15, max: 17 },
      { label: "17-19m", min: 17, max: 19 },
      { label: "19m+", min: 19, max: null },
    ],
  },
  HAMMER: {
    MALE: [
      { label: "45-55m", min: 45, max: 55 },
      { label: "55-65m", min: 55, max: 65 },
      { label: "65-75m", min: 65, max: 75 },
      { label: "75m+", min: 75, max: null },
    ],
    FEMALE: [
      { label: "45-50m", min: 45, max: 50 },
      { label: "50-55m", min: 50, max: 55 },
      { label: "55-60m+", min: 55, max: null },
    ],
  },
  DISCUS: {
    MALE: [
      { label: "40-50m", min: 40, max: 50 },
      { label: "50-60m", min: 50, max: 60 },
      { label: "60m+", min: 60, max: null },
    ],
    FEMALE: [
      { label: "40-50m", min: 40, max: 50 },
      { label: "50-60m", min: 50, max: 60 },
      { label: "60m+", min: 60, max: null },
    ],
  },
  JAVELIN: {
    MALE: [
      { label: "50-60m", min: 50, max: 60 },
      { label: "60-70m", min: 60, max: 70 },
      { label: "70-80m", min: 70, max: 80 },
      { label: "80m+", min: 80, max: null },
    ],
    FEMALE: [
      { label: "40-50m", min: 40, max: 50 },
      { label: "50-60m", min: 50, max: 60 },
      { label: "60m+", min: 60, max: null },
    ],
  },
};

export function getDistanceBand(event: EventType, gender: Gender, pr: number | null): DistanceBand {
  const bands = DISTANCE_BANDS[event]?.[gender];
  if (!bands || pr == null) {
    return { label: "Unknown", min: 0, max: null };
  }
  for (let i = bands.length - 1; i >= 0; i--) {
    if (pr >= bands[i].min) return bands[i];
  }
  return bands[0];
}

/* ─── Implement Weights by Event/Gender/Band ──────────────────────── */

type ImplementSet = { light: string[]; competition: string; heavy: string[] };

const IMPLEMENTS: Record<EventType, Record<Gender, Record<string, ImplementSet>>> = {
  SHOT_PUT: {
    MALE: {
      "14-16m": { light: ["5kg"], competition: "7.26kg", heavy: ["8kg"] },
      "16-18m": { light: ["5kg", "6kg"], competition: "7.26kg", heavy: ["8kg", "9kg"] },
      "18-20m": { light: ["6kg"], competition: "7.26kg", heavy: ["8kg", "9kg"] },
      "20m+": { light: ["6kg"], competition: "7.26kg", heavy: ["8kg", "9kg", "10kg"] },
    },
    FEMALE: {
      "13-15m": { light: ["3kg"], competition: "4kg", heavy: ["5kg"] },
      "15-17m": { light: ["3kg", "3.5kg"], competition: "4kg", heavy: ["5kg", "6kg"] },
      "17-19m": { light: ["3.5kg"], competition: "4kg", heavy: ["5kg", "6kg"] },
      "19m+": { light: ["3.5kg"], competition: "4kg", heavy: ["6kg", "7.26kg"] },
    },
  },
  HAMMER: {
    MALE: {
      "45-55m": { light: ["5kg"], competition: "7.26kg", heavy: ["8kg"] },
      "55-65m": { light: ["5kg", "6kg"], competition: "7.26kg", heavy: ["8kg", "9kg"] },
      "65-75m": { light: ["6kg"], competition: "7.26kg", heavy: ["8kg", "9kg", "10kg"] },
      "75m+": { light: ["6kg"], competition: "7.26kg", heavy: ["9kg", "10kg"] },
    },
    FEMALE: {
      "45-50m": { light: ["3kg"], competition: "4kg", heavy: ["5kg"] },
      "50-55m": { light: ["3kg", "3.5kg"], competition: "4kg", heavy: ["5kg", "6kg"] },
      "55-60m+": { light: ["3.5kg"], competition: "4kg", heavy: ["5kg", "6kg"] },
    },
  },
  DISCUS: {
    MALE: {
      "40-50m": { light: ["1.5kg"], competition: "2kg", heavy: ["2.25kg"] },
      "50-60m": { light: ["1.5kg", "1.75kg"], competition: "2kg", heavy: ["2.25kg", "2.5kg"] },
      "60m+": { light: ["1.75kg"], competition: "2kg", heavy: ["2.5kg", "2.75kg"] },
    },
    FEMALE: {
      "40-50m": { light: ["0.75kg"], competition: "1kg", heavy: ["1.25kg"] },
      "50-60m": { light: ["0.75kg"], competition: "1kg", heavy: ["1.5kg", "1.75kg"] },
      "60m+": { light: ["0.75kg"], competition: "1kg", heavy: ["1.5kg", "2kg"] },
    },
  },
  JAVELIN: {
    MALE: {
      "50-60m": { light: ["600g"], competition: "800g", heavy: ["900g"] },
      "60-70m": { light: ["600g", "700g"], competition: "800g", heavy: ["900g", "1kg"] },
      "70-80m": { light: ["700g"], competition: "800g", heavy: ["900g", "1kg"] },
      "80m+": { light: ["700g"], competition: "800g", heavy: ["1kg", "1.1kg", "1.2kg"] },
    },
    FEMALE: {
      "40-50m": { light: ["400g"], competition: "600g", heavy: ["700g"] },
      "50-60m": { light: ["400g", "500g"], competition: "600g", heavy: ["700g", "800g"] },
      "60m+": { light: ["500g"], competition: "600g", heavy: ["800g", "900g"] },
    },
  },
};

function getImplementSet(event: EventType, gender: Gender, band: string): ImplementSet {
  return (
    IMPLEMENTS[event]?.[gender]?.[band] ?? {
      light: [],
      competition: "Competition",
      heavy: [],
    }
  );
}

/* ─── Equipment-Aware Filtering ───────────────────────────────────── */

export type AvailableImplement = { weightKg: number; type: string };

const EVENT_TO_IMPLEMENT_TYPE: Record<EventType, string> = {
  SHOT_PUT: "shot",
  DISCUS: "disc",
  HAMMER: "hammer",
  JAVELIN: "jav",
};

// Canonical labels in IMPLEMENTS[] are formatted as "<num>kg" or "<num>g"
// (javelin). Translate back to a kg comparison so we can intersect with the
// athlete's owned weights from EquipmentInventory.
function parseLabelKg(label: string): number | null {
  const m = label.match(/^(\d+(?:\.\d+)?)\s*(kg|g)$/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  return m[2].toLowerCase() === "g" ? value / 1000 : value;
}

function intersect(labels: string[], owned: Set<number>): string[] {
  return labels.filter((label) => {
    const kg = parseLabelKg(label);
    if (kg == null) return true; // unparseable label — preserve rather than drop silently
    // 10g tolerance covers both float-comparison drift and plate-rounding
    // (e.g. 7.25kg in EquipmentInventory matching a "7.26kg" canonical label).
    for (const ownedKg of owned) {
      if (Math.abs(ownedKg - kg) <= 0.01) return true;
    }
    return false;
  });
}

/**
 * Narrows the canonical ImplementSet to weights the athlete actually owns,
 * per their EquipmentInventory. Used to make the architect's block 1/2
 * progressions data-driven rather than aspirational.
 *
 * Behavior:
 *   - `available` undefined or empty → no filtering, returns canonical set.
 *   - `available` provided but no entries match the event's implement type
 *     → no filtering (athlete hasn't recorded this event's equipment yet).
 *   - Filter narrows but heavy[] non-empty → returns narrowed set.
 *   - Filter empties heavy[] (or light[]) AND canonical was non-empty →
 *     falls back to canonical for that bucket and returns the missing
 *     weights so the caller can surface a phase conflict. The session
 *     should still print a defensible plan even when the athlete is
 *     missing prescribed gear.
 */
export function filterImplementSet(
  set: ImplementSet,
  event: EventType,
  available: AvailableImplement[] | undefined
): { set: ImplementSet; missing: { heavy: string[]; light: string[] } } {
  const noMissing = { heavy: [] as string[], light: [] as string[] };
  if (!available || available.length === 0) return { set, missing: noMissing };

  const targetType = EVENT_TO_IMPLEMENT_TYPE[event];
  const owned = new Set<number>(
    available.filter((i) => i.type === targetType).map((i) => i.weightKg)
  );
  if (owned.size === 0) return { set, missing: noMissing };

  const narrowedHeavy = intersect(set.heavy, owned);
  const narrowedLight = intersect(set.light, owned);

  // Fall back to canonical when the filter empties a non-empty bucket —
  // a missing-equipment warning is more useful than a session with no
  // heavy progressions at all.
  const heavy = narrowedHeavy.length === 0 && set.heavy.length > 0 ? set.heavy : narrowedHeavy;
  const light = narrowedLight.length === 0 && set.light.length > 0 ? set.light : narrowedLight;

  const missingHeavy = narrowedHeavy.length === 0 && set.heavy.length > 0 ? set.heavy : [];
  const missingLight = narrowedLight.length === 0 && set.light.length > 0 ? set.light : [];

  return {
    set: { light, competition: set.competition, heavy },
    missing: { heavy: missingHeavy, light: missingLight },
  };
}

/* ─── Strength Benchmarks (by event + distance band) ──────────────── */

type BenchmarkDef = { lift: string; key: string; standard: number; unit: string };

const STRENGTH_STANDARDS: Record<string, BenchmarkDef[]> = {
  // Shot Put Male benchmarks (relative to bodyweight or absolute)
  "SHOT_PUT_MALE_16-18m": [
    { lift: "Back Squat", key: "backSquat", standard: 200, unit: "kg" },
    { lift: "Power Clean", key: "powerClean", standard: 130, unit: "kg" },
    { lift: "Snatch", key: "snatch", standard: 100, unit: "kg" },
    { lift: "Bench Press", key: "benchPress", standard: 150, unit: "kg" },
  ],
  "SHOT_PUT_MALE_18-20m": [
    { lift: "Back Squat", key: "backSquat", standard: 220, unit: "kg" },
    { lift: "Power Clean", key: "powerClean", standard: 145, unit: "kg" },
    { lift: "Snatch", key: "snatch", standard: 115, unit: "kg" },
    { lift: "Bench Press", key: "benchPress", standard: 165, unit: "kg" },
  ],
  "SHOT_PUT_MALE_20m+": [
    { lift: "Back Squat", key: "backSquat", standard: 250, unit: "kg" },
    { lift: "Power Clean", key: "powerClean", standard: 160, unit: "kg" },
    { lift: "Snatch", key: "snatch", standard: 130, unit: "kg" },
    { lift: "Bench Press", key: "benchPress", standard: 180, unit: "kg" },
  ],
  // Hammer Male benchmarks
  "HAMMER_MALE_45-55m": [
    { lift: "Back Squat", key: "backSquat", standard: 160, unit: "kg" },
    { lift: "Power Clean", key: "powerClean", standard: 110, unit: "kg" },
    { lift: "Snatch", key: "snatch", standard: 85, unit: "kg" },
  ],
  "HAMMER_MALE_55-65m": [
    { lift: "Back Squat", key: "backSquat", standard: 190, unit: "kg" },
    { lift: "Power Clean", key: "powerClean", standard: 125, unit: "kg" },
    { lift: "Snatch", key: "snatch", standard: 100, unit: "kg" },
  ],
  "HAMMER_MALE_65-75m": [
    { lift: "Back Squat", key: "backSquat", standard: 210, unit: "kg" },
    { lift: "Power Clean", key: "powerClean", standard: 140, unit: "kg" },
    { lift: "Snatch", key: "snatch", standard: 110, unit: "kg" },
  ],
  "HAMMER_MALE_75m+": [
    { lift: "Back Squat", key: "backSquat", standard: 230, unit: "kg" },
    { lift: "Power Clean", key: "powerClean", standard: 155, unit: "kg" },
    { lift: "Snatch", key: "snatch", standard: 125, unit: "kg" },
  ],
};

/* ─── Phase Distribution ─────────────────────────────────────────────── */

const PHASE_DISTRIBUTION: Record<
  TrainingPhase,
  { ce: string; sde: string; spe: string; gpe: string }
> = {
  ACCUMULATION: { ce: "15%", sde: "35%", spe: "30%", gpe: "20%" },
  CONVERSION: { ce: "25%", sde: "40%", spe: "25%", gpe: "10%" },
  REALIZATION: { ce: "40%", sde: "35%", spe: "20%", gpe: "5%" },
};

const PHASE_VOLUMES: Record<
  TrainingPhase,
  { throwsPerWeek: string; strengthDays: string; weekDuration: string }
> = {
  ACCUMULATION: { throwsPerWeek: "200-300", strengthDays: "3-4x/wk", weekDuration: "4-6 weeks" },
  CONVERSION: { throwsPerWeek: "150-200", strengthDays: "2-3x/wk", weekDuration: "3-4 weeks" },
  REALIZATION: { throwsPerWeek: "100-150", strengthDays: "1-2x/wk", weekDuration: "2-3 weeks" },
};

/* ─── Core Analysis ──────────────────────────────────────────────── */

export type ArchitectInput = {
  name: string;
  event: EventType;
  gender: Gender;
  pr: number | null;
  daysToChampionship: number;
  trainingPhase: TrainingPhase;
  strengthNumbers: Record<string, number> | null;
  /**
   * Athlete's owned implements from EquipmentInventory.implements. When
   * provided and at least one entry matches the event's implement type,
   * the architect narrows block 1/2 progressions to the intersection.
   * When omitted, the engine prescribes the canonical set (legacy
   * behavior). See `filterImplementSet`.
   */
  availableImplements?: AvailableImplement[];
};

export function runArchitectAnalysis(input: ArchitectInput): ArchitectAnalysis {
  const {
    name,
    event,
    gender,
    pr,
    daysToChampionship,
    trainingPhase,
    strengthNumbers,
    availableImplements,
  } = input;

  // 1. Distance band
  const distanceBand = getDistanceBand(event, gender, pr);

  // 2. Phase conflicts
  const phaseConflicts = detectPhaseConflicts(daysToChampionship, trainingPhase);

  // 3. Deficit analysis
  const deficitProfile = analyzeDeficits(event, gender, distanceBand.label, strengthNumbers);

  // 4. Method selection
  const method = selectMethod(daysToChampionship);

  // 5. Session structure (narrowed to athlete's owned implements when known)
  const canonicalSet = getImplementSet(event, gender, distanceBand.label);
  const { set: implementSet, missing } = filterImplementSet(
    canonicalSet,
    event,
    availableImplements
  );
  if (missing.heavy.length > 0) {
    phaseConflicts.push({
      type: "warning",
      message: `Athlete's equipment inventory is missing the heavy implement(s) prescribed for this band (${missing.heavy.join(", ")}). Session falls back to canonical heavy weights — coach should source the gear or adjust the plan.`,
    });
  }
  if (missing.light.length > 0) {
    phaseConflicts.push({
      type: "warning",
      message: `Athlete's equipment inventory is missing the light implement(s) prescribed for this band (${missing.light.join(", ")}). Session falls back to canonical light weights.`,
    });
  }
  const sessionStructure = buildSessionStructure(
    event,
    trainingPhase,
    implementSet,
    deficitProfile
  );

  // 6. Weekly distribution
  const weeklyDistribution = PHASE_DISTRIBUTION[trainingPhase];

  return {
    athlete: { name, event, gender, pr, distanceBand },
    context: { daysToChampionship, trainingPhase, phaseConflicts },
    deficitProfile,
    method,
    sessionStructure,
    weeklyDistribution,
  };
}

/* ─── Phase Conflict Detection ───────────────────────────────────── */

function detectPhaseConflicts(days: number, phase: TrainingPhase): PhaseConflict[] {
  const conflicts: PhaseConflict[] = [];

  if (days <= 30 && phase === "ACCUMULATION") {
    conflicts.push({
      type: "error",
      message: `Only ${days} days to championship — Accumulation phase is inappropriate. Consider Realization or a taper.`,
    });
  }

  if (days <= 45 && phase === "ACCUMULATION") {
    conflicts.push({
      type: "warning",
      message: `${days} days out and still in Accumulation — transition to Conversion soon to allow time for sports form.`,
    });
  }

  if (days > 90 && phase === "REALIZATION") {
    conflicts.push({
      type: "warning",
      message: `${days} days out — Realization is premature. The athlete may peak too early. Consider Accumulation or early Conversion.`,
    });
  }

  return conflicts;
}

/* ─── Deficit Analysis ───────────────────────────────────────────── */

function analyzeDeficits(
  event: EventType,
  gender: Gender,
  bandLabel: string,
  strengthNumbers: Record<string, number> | null
): DeficitProfile {
  const benchmarkKey = `${event}_${gender}_${bandLabel}`;
  const defs = STRENGTH_STANDARDS[benchmarkKey];

  if (!defs || !strengthNumbers) {
    return {
      type: "balanced",
      label: "Insufficient data",
      description:
        "No strength benchmarks available for this athlete/distance band. Complete the athlete's strength profile to enable deficit analysis.",
      strengthBenchmarks: [],
      primaryDeficit: null,
    };
  }

  const benchmarks: StrengthBenchmark[] = defs.map((def) => {
    const current = strengthNumbers[def.key] ?? null;
    let status: StrengthBenchmark["status"] = "unknown";
    let deficit: number | null = null;

    if (current != null) {
      const ratio = current / def.standard;
      deficit = Math.round((1 - ratio) * 100);
      if (ratio >= 0.95) status = "above";
      else if (ratio >= 0.85) status = "at";
      else status = "below";
    }

    return { lift: def.lift, standard: def.standard, unit: def.unit, current, status, deficit };
  });

  const belowCount = benchmarks.filter((b) => b.status === "below").length;
  const aboveCount = benchmarks.filter((b) => b.status === "above").length;
  const unknownCount = benchmarks.filter((b) => b.status === "unknown").length;

  // Determine profile type
  if (unknownCount === benchmarks.length) {
    return {
      type: "balanced",
      label: "Insufficient data",
      description:
        "Strength numbers are missing. Complete the athlete's profile to enable deficit analysis.",
      strengthBenchmarks: benchmarks,
      primaryDeficit: null,
    };
  }

  const worstDeficit = benchmarks
    .filter((b) => b.deficit != null && b.status === "below")
    .sort((a, b) => (b.deficit ?? 0) - (a.deficit ?? 0))[0];

  if (belowCount === 0) {
    return {
      type: "speed-dominant",
      label: "Force-sufficient, speed-deficit likely",
      description:
        "All strength numbers meet or exceed standards. The deficit is likely in velocity/technical transfer — prioritize competition-weight and light implement work.",
      strengthBenchmarks: benchmarks,
      primaryDeficit: "velocity/technical transfer",
    };
  }

  if (aboveCount === 0 && belowCount >= 2) {
    return {
      type: "under-developed",
      label: "General strength deficit",
      description:
        "Multiple lifts below standard. Focus on building the strength base before specializing implement work.",
      strengthBenchmarks: benchmarks,
      primaryDeficit: worstDeficit?.lift ?? null,
    };
  }

  if (aboveCount > 0 && belowCount > 0) {
    // Some high, some low — imbalanced
    const highLifts = benchmarks.filter((b) => b.status === "above").map((b) => b.lift);
    const lowLifts = benchmarks.filter((b) => b.status === "below").map((b) => b.lift);

    // Check if it's the classic "over-powered / under-transferred" pattern
    const hasHighSquat = highLifts.some((l) => l.includes("Squat"));
    const hasHighClean = highLifts.some((l) => l.includes("Clean"));
    const isForceHigh = hasHighSquat || hasHighClean;

    if (isForceHigh) {
      return {
        type: "force-dominant",
        label: "Over-powered, under-transferred",
        description: `Strong in ${highLifts.join(", ")} but below standard in ${lowLifts.join(", ")}. The strength isn't transferring — prioritize velocity work and implement-specific throws.`,
        strengthBenchmarks: benchmarks,
        primaryDeficit: lowLifts[0] ?? null,
      };
    }

    return {
      type: "balanced",
      label: "Mixed profile",
      description: `Above standard in ${highLifts.join(", ")}, below in ${lowLifts.join(", ")}. Address the weakest lifts while maintaining strengths.`,
      strengthBenchmarks: benchmarks,
      primaryDeficit: worstDeficit?.lift ?? null,
    };
  }

  return {
    type: "balanced",
    label: "At standard",
    description:
      "Strength numbers are at or near standard for this distance band. Focus on transfer via competition and heavy implement work.",
    strengthBenchmarks: benchmarks,
    primaryDeficit: null,
  };
}

/* ─── Method Selection ───────────────────────────────────────────── */

function selectMethod(days: number): ArchitectAnalysis["method"] {
  const threshold = 60;

  if (days <= threshold) {
    return {
      selected: "VARIATION",
      rationale: `${days} days out — inside the 60-day window. Variation method maintains form without peaking too early. Change exercises every 3-4 weeks to sustain sports form (Vol IV p.169).`,
      daysThreshold: threshold,
    };
  }

  return {
    selected: "COMPLEX",
    rationale: `${days} days out — enough runway for Complex method. Keep the same exercise complex until sports form is achieved. Changing exercises too early prolongs adaptation 2-3x (Vol IV p.170).`,
    daysThreshold: threshold,
  };
}

/* ─── Session Structure ──────────────────────────────────────────── */

function buildSessionStructure(
  event: EventType,
  phase: TrainingPhase,
  implements_: ImplementSet,
  deficit: DeficitProfile
): SessionStructure {
  const phaseVol = PHASE_VOLUMES[phase];
  const minThrows = event === "HAMMER" ? "6-8" : "10-12";

  // Build blocks based on phase
  const blocks: SessionBlock[] = [];

  if (phase === "ACCUMULATION") {
    // Heavy emphasis — Template C pattern
    blocks.push({
      type: "THROWING",
      label: "Block 1 — Heavy (primary benefit, 3-4x adaptation speed)",
      position: 1,
      implements: implements_.heavy.slice(0, 2).map((w, i) => ({
        weight: w,
        role: "heavy" as const,
        throwCount: minThrows,
        intensityRange: "85-90% (1-2 throws at 95-100%)",
        position: i + 1,
      })),
    });

    blocks.push({
      type: "STRENGTH",
      label: "Block 2 — Strength (enables passive activation)",
      position: 2,
      exercises: getStrengthExercises(deficit, "primary"),
      notes: "Required between throwing blocks — Vol IV p.113",
    });

    blocks.push({
      type: "THROWING",
      label: "Block 3 — Heavy/Competition (feeds Block 1)",
      position: 3,
      implements: [
        {
          weight: implements_.heavy[0] ?? implements_.competition,
          role: (implements_.heavy[0] ? "heavy" : "competition") as "heavy" | "competition",
          throwCount: minThrows,
          intensityRange: "85-90%",
          position: 1,
        },
      ],
    });

    blocks.push({
      type: "STRENGTH",
      label: "Block 4 — Strength (accessory)",
      position: 4,
      exercises: getStrengthExercises(deficit, "accessory"),
    });

    return {
      template: "Heavy Emphasis (Accumulation)",
      description:
        "High-volume heavy implement work to build the strength-transfer base. No light implements mixed with heavy — Volume IV mandate.",
      blocks,
      totalThrows: "24-34",
      weeklyVolume: phaseVol.throwsPerWeek,
      restIntervals: { throws: "30-90 sec between throws", strength: "3-5 min between sets" },
    };
  }

  if (phase === "CONVERSION") {
    // Mixed — Template A pattern: heavy + competition
    blocks.push({
      type: "THROWING",
      label: "Block 1 — Heavy (potentiates competition)",
      position: 1,
      implements: implements_.heavy.slice(0, 1).map((w) => ({
        weight: w,
        role: "heavy" as const,
        throwCount: minThrows,
        intensityRange: "85-90% (2 throws at 95-100%)",
        position: 1,
      })),
    });

    blocks.push({
      type: "STRENGTH",
      label: "Block 2 — Strength",
      position: 2,
      exercises: getStrengthExercises(deficit, "primary"),
      notes: "Required between throwing blocks — Vol IV p.113",
    });

    blocks.push({
      type: "THROWING",
      label: "Block 3 — Competition (benefits from heavy)",
      position: 3,
      implements: [
        {
          weight: implements_.competition,
          role: "competition",
          throwCount: minThrows,
          intensityRange: "90-95%",
          position: 1,
        },
      ],
    });

    blocks.push({
      type: "STRENGTH",
      label: "Block 4 — Strength (accessory)",
      position: 4,
      exercises: getStrengthExercises(deficit, "accessory"),
    });

    return {
      template: "Competition Prep (Conversion)",
      description:
        "Heavy implements first to potentiate competition weight. The competition block benefits from passive activation. Strength blocks separate throws.",
      blocks,
      totalThrows: "18-24",
      weeklyVolume: phaseVol.throwsPerWeek,
      restIntervals: { throws: "1-2 min between throws", strength: "3-5 min between sets" },
    };
  }

  // REALIZATION — Template B/E pattern: competition focus
  blocks.push({
    type: "THROWING",
    label: "Block 1 — Heavy (brief potentiation)",
    position: 1,
    implements: [
      {
        weight: implements_.heavy[0] ?? implements_.competition,
        role: "heavy",
        throwCount: "6-8",
        intensityRange: "85-90%",
        position: 1,
      },
    ],
  });

  blocks.push({
    type: "STRENGTH",
    label: "Block 2 — Strength (maintenance only)",
    position: 2,
    exercises: getStrengthExercises(deficit, "maintenance"),
    notes: "Low volume — maintain, don't build",
  });

  blocks.push({
    type: "THROWING",
    label: "Block 3 — Competition (full effort, feel-based)",
    position: 3,
    implements: [
      {
        weight: implements_.competition,
        role: "competition",
        throwCount: minThrows,
        intensityRange: "95-100%",
        position: 1,
      },
    ],
  });

  return {
    template: "Competition Focus (Realization)",
    description:
      "Minimal heavy work for potentiation, then full-effort competition throws. Reduce volume, increase intensity. Sports form window.",
    blocks,
    totalThrows: "14-20",
    weeklyVolume: phaseVol.throwsPerWeek,
    restIntervals: { throws: "2-3 min between throws", strength: "3-5 min between sets" },
  };
}

/* ─── Strength Exercise Selection ────────────────────────────────── */

function getStrengthExercises(
  deficit: DeficitProfile,
  tier: "primary" | "accessory" | "maintenance"
): string[] {
  if (tier === "maintenance") {
    return ["Power Clean: 2x3 @ 70%", "Front Squat: 2x3 @ 65%", "Core: 2x8"];
  }

  if (tier === "accessory") {
    return ["Good Mornings: 3x6 @ 60kg", "Step-ups: 3x8 @ 60kg", "Hanging Leg Raise: 3x8"];
  }

  // Primary — adapt to deficit
  if (deficit.type === "force-dominant") {
    return [
      "Snatch: 4x3 @ 80% (speed emphasis)",
      "Squat Jumps: 3x5 @ 60kg (velocity)",
      "Med Ball Rotational Throws: 3x8",
    ];
  }

  if (deficit.type === "under-developed") {
    return ["Back Squat: 4x5 @ 82%", "Power Clean: 4x3 @ 80%", "Romanian Deadlift: 3x8 @ 70%"];
  }

  // Balanced or speed-dominant
  return ["Snatch: 3x5 @ 80%", "Half Squat: 3x5 @ 80%", "Clean Pulls: 3x4 @ 85%"];
}
