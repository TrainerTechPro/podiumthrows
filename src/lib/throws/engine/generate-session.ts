// ── Session Generator ────────────────────────────────────────────────
// Builds a single training session with Bondarchuk 4-part structure:
//   Block 1: CE + SD heavy throws (heaviest implements)
//   Block 2: Primary strength (Olympic lifts + Compounds)
//   Block 3: SD comp/light + SP throws (lighter implements)
//   Block 4: Accessory + Core strength
//
// This alternating structure (CE → Strength → CE → Strength) cuts
// adaptation time in half via passive activation transfer.

import { PHASE_RATIOS, REST_INTERVALS, COMPETITION_WEIGHTS, PHASE_IMPLEMENT_DIST, MIN_THROWS, CODE_EVENT_MAP } from "../constants";
import type { TrainingPhase, EventCode } from "../constants";
import { selectStrength, splitStrengthByBlock } from "./select-strength";
import { applyContrastPattern } from "./contrast-patterns";
import type {
  GeneratedSession,
  SessionBlock,
  ThrowPrescription,
  WarmupPrescription,
  ExerciseComplexEntry,
  SessionGenConfig,
} from "./types";

// ── Main Function ───────────────────────────────────────────────────

export function generateSession(config: SessionGenConfig): GeneratedSession {
  const {
    weekNumber,
    dayOfWeek,
    dayType,
    focus,
    throwsMin,
    throwsMax,
    strengthLevel,
    phase,
    exerciseComplex,
    includeLift,
    programConfig,
    rotationIndex,
  } = config;

  // Target throws: midpoint of min/max
  let totalThrows = Math.round((throwsMin + throwsMax) / 2);

  // Enforce minimum throws floor for motor learning effectiveness
  if (totalThrows > 0) {
    const throwEvent = CODE_EVENT_MAP[programConfig.eventCode as EventCode];
    const minFloor = throwEvent ? MIN_THROWS[throwEvent] : 8;
    if (totalThrows < minFloor) {
      totalThrows = minFloor;
    }
  }

  const hasStrength = includeLift && strengthLevel !== "None";
  const sessionType = totalThrows <= 0
    ? "LIFT_ONLY"
    : hasStrength
      ? "THROWS_LIFT"
      : "THROWS_ONLY";

  // ── Generate throw prescriptions ─────────────────────────────
  const throws = generateThrows(
    totalThrows,
    phase,
    exerciseComplex,
    programConfig,
  );

  // ── Generate strength prescriptions ──────────────────────────
  const strength = hasStrength
    ? selectStrength({
        exerciseComplex,
        liftingPrs: programConfig.liftingPrs,
        phase,
        strengthLevel,
        rotationIndex,
      })
    : [];

  // ── Generate warmup ──────────────────────────────────────────
  const warmup = generateWarmup(phase, dayType);

  // ── Build 4-part Bondarchuk session blocks ───────────────────
  const blocks = buildSessionBlocks(throws, strength, warmup, hasStrength);

  // ── Estimate duration ────────────────────────────────────────
  const throwDuration = totalThrows * 1.5;
  const strengthDuration = strength.length * 8;
  const warmupDuration = 15;
  const estimatedDuration = Math.round(warmupDuration + throwDuration + strengthDuration);

  return {
    weekNumber,
    dayOfWeek,
    dayType,
    sessionType,
    focusLabel: focus,
    throws,
    strength,
    warmup,
    blocks,
    totalThrowsTarget: totalThrows,
    estimatedDuration,
  };
}

// ── 4-Part Session Block Builder ────────────────────────────────────

/**
 * Builds the Bondarchuk session structure:
 *   0. Warmup
 *   1. Throwing Block 1: CE + SD heavy (heaviest implements first)
 *   2. Strength Block 1: Olympic lifts + Compound lifts
 *   3. Throwing Block 2: SD comp/light + SP (lighter implements)
 *   4. Strength Block 2: Accessories + Core
 *
 * If no strength, throws still split into two blocks for
 * proper implement sequencing (heavy → light).
 */
function buildSessionBlocks(
  throws: ThrowPrescription[],
  strength: import("./types").StrengthPrescription[],
  warmup: WarmupPrescription[],
  hasStrength: boolean,
): SessionBlock[] {
  const blocks: SessionBlock[] = [];
  let order = 0;

  // Block 0: Warmup
  blocks.push({
    order: order++,
    type: "WARMUP",
    label: "Warm-Up",
  });

  // Split throws: heavy first, lighter second
  const throwBlock1: ThrowPrescription[] = []; // CE + SD heavy
  const throwBlock2: ThrowPrescription[] = []; // SD comp + SD light + SP

  for (const t of throws) {
    if (t.category === "CE") {
      throwBlock1.push(t);
    } else if (t.category === "SD") {
      // SD heavy goes in block 1, SD comp/light in block 2
      // Check if this is a heavy implement (notes may contain exercise name)
      // Use the prescription order: first SD entries are heavy (from generateThrows ordering)
      if (throwBlock1.length < throws.length * 0.4 && isHeavySd(t, throws)) {
        throwBlock1.push(t);
      } else {
        throwBlock2.push(t);
      }
    } else {
      // SP goes in block 2
      throwBlock2.push(t);
    }
  }

  // Block 1: Throwing (heavy)
  if (throwBlock1.length > 0) {
    blocks.push({
      order: order++,
      type: "THROWING",
      label: "Throwing — Competition & Heavy",
      throws: throwBlock1,
    });
  }

  if (hasStrength && strength.length > 0) {
    const { primary, accessory } = splitStrengthByBlock(strength);

    // Block 2: Primary strength
    if (primary.length > 0) {
      blocks.push({
        order: order++,
        type: "STRENGTH",
        label: "Strength — Olympic & Compound",
        strength: primary,
      });
    }

    // Block 3: Throwing (lighter)
    if (throwBlock2.length > 0) {
      blocks.push({
        order: order++,
        type: "THROWING",
        label: "Throwing — Developmental & Drills",
        throws: throwBlock2,
      });
    }

    // Block 4: Accessory strength
    if (accessory.length > 0) {
      blocks.push({
        order: order++,
        type: "STRENGTH",
        label: "Strength — Accessories & Core",
        strength: accessory,
      });
    }
  } else {
    // No strength — put remaining throws in block 2
    if (throwBlock2.length > 0) {
      blocks.push({
        order: order++,
        type: "THROWING",
        label: "Throwing — Developmental & Drills",
        throws: throwBlock2,
      });
    }
  }

  return blocks;
}

/**
 * Determine if an SD prescription is "heavy" based on implement weight
 * relative to other SD prescriptions in the session.
 */
function isHeavySd(
  prescription: ThrowPrescription,
  allThrows: ThrowPrescription[],
): boolean {
  const sdThrows = allThrows.filter((t) => t.category === "SD");
  if (sdThrows.length <= 1) return true;

  // Find the median SD implement weight
  const weights = sdThrows
    .map((t) => t.implementKg)
    .filter((w) => w > 0)
    .sort((a, b) => b - a);

  if (weights.length === 0) return false;
  const median = weights[Math.floor(weights.length / 2)];
  return prescription.implementKg >= median;
}

// ── Throw Distribution ──────────────────────────────────────────────

function generateThrows(
  totalThrows: number,
  phase: TrainingPhase,
  exerciseComplex: ExerciseComplexEntry[],
  programConfig: {
    eventCode: string;
    genderCode: string;
    competitionPr: number;
    availableImplements: Array<{ weightKg: number; type: string }>;
  },
): ThrowPrescription[] {
  if (totalThrows <= 0) return [];

  const ratios = PHASE_RATIOS[phase];
  const restIntervals = REST_INTERVALS[phase];

  const compWeight =
    COMPETITION_WEIGHTS[programConfig.eventCode as keyof typeof COMPETITION_WEIGHTS]?.[
      programConfig.genderCode as "M" | "F"
    ] ?? 7.26;

  const phaseDist = PHASE_IMPLEMENT_DIST.find((d) => d.phase === phase);
  const lightPct = phaseDist?.lightPercent ?? 25;
  const compPct = phaseDist?.compPercent ?? 40;
  const heavyPct = phaseDist?.heavyPercent ?? 35;

  const ceThrows = Math.round((totalThrows * ratios.CE) / 100);
  const sdThrows = Math.round((totalThrows * ratios.SD) / 100);
  const spThrows = Math.round((totalThrows * ratios.SP) / 100);

  const sdExercises = exerciseComplex.filter((e) => e.classification === "SD");
  const sdHeavy = sdExercises.filter((e) => (e.implementKg ?? 0) > compWeight);
  const sdComp = sdExercises.filter((e) => (e.implementKg ?? 0) === compWeight);
  const sdLight = sdExercises.filter(
    (e) => e.implementKg !== undefined && e.implementKg > 0 && e.implementKg < compWeight,
  );
  const sdUnknown = sdExercises.filter(
    (e) => e.implementKg === undefined || e.implementKg === 0,
  );

  const sdTotalForDist = sdThrows;
  let sdHeavyThrows = Math.round((sdTotalForDist * heavyPct) / 100);
  let sdCompThrows = Math.round((sdTotalForDist * compPct) / 100);
  let sdLightThrows = Math.round((sdTotalForDist * lightPct) / 100);

  if (sdHeavy.length === 0 && sdHeavyThrows > 0) {
    sdCompThrows += Math.round(sdHeavyThrows * 0.6);
    sdLightThrows += Math.round(sdHeavyThrows * 0.4);
    sdHeavyThrows = 0;
  }
  if (sdLight.length === 0 && sdLightThrows > 0) {
    sdCompThrows += Math.round(sdLightThrows * 0.6);
    sdHeavyThrows += Math.round(sdLightThrows * 0.4);
    sdLightThrows = 0;
  }
  if (sdComp.length === 0 && sdCompThrows > 0) {
    sdHeavyThrows += Math.round(sdCompThrows * 0.5);
    sdLightThrows += Math.round(sdCompThrows * 0.5);
    sdCompThrows = 0;
  }

  const sdUnknownThrows = sdUnknown.length > 0
    ? Math.round(sdTotalForDist * 0.1)
    : 0;
  if (sdUnknownThrows > 0) {
    sdCompThrows = Math.max(0, sdCompThrows - sdUnknownThrows);
  }

  const prescriptions: ThrowPrescription[] = [];

  // BONDARCHUK RULE: Strict descending weight order.
  // SD heavy (9kg, 8kg) → CE comp (7.26kg) → SD comp drills → SD light (6kg, 5kg)
  // The heaviest implement in the session MUST come first.

  // 1. SD heavy: overweight implements (HEAVIEST — always first)
  if (sdHeavyThrows > 0 && sdHeavy.length > 0) {
    buildSdPrescriptions(sdHeavy, sdHeavyThrows, restIntervals.SD, prescriptions);
  }

  // 2. CE throws: competition weight full throws (after heavy)
  if (ceThrows > 0) {
    const sets = Math.max(1, Math.round(ceThrows / 4));
    const reps = Math.max(1, Math.round(ceThrows / sets));

    prescriptions.push({
      implement: `${compWeight}kg`,
      implementKg: compWeight,
      category: "CE",
      drillType: "FULL_THROW",
      sets,
      repsPerSet: reps,
      restSeconds: restIntervals.CE,
    });
  }

  // 3. SD comp: competition weight drills
  if (sdCompThrows > 0 && sdComp.length > 0) {
    buildSdPrescriptions(sdComp, sdCompThrows, restIntervals.SD, prescriptions);
  }

  // 4. SD light: underweight implements (speed contrast — lightest last)
  if (sdLightThrows > 0 && sdLight.length > 0) {
    buildSdPrescriptions(sdLight, sdLightThrows, restIntervals.SD, prescriptions);
  }

  // 4b. SD unknown
  if (sdUnknownThrows > 0 && sdUnknown.length > 0) {
    buildSdPrescriptions(sdUnknown, sdUnknownThrows, restIntervals.SD, prescriptions);
  }

  // Apply PAP contrast pattern to SD blocks, then merge all throws
  // in strict descending weight order: SD heavy → CE → SD comp → SD light
  const sdPrescriptions = prescriptions.filter((p) => p.category === "SD");
  if (sdPrescriptions.length > 0) {
    const cePrescriptions = prescriptions.filter((p) => p.category === "CE");
    const interleavedSd = applyContrastPattern(sdPrescriptions, phase);

    // Split SD into heavy (> comp weight) and light (<= comp weight)
    const ceWeight = cePrescriptions[0]?.implementKg ?? compWeight;
    const sdAboveComp = interleavedSd.filter((p) => p.implementKg > ceWeight);
    const sdAtOrBelowComp = interleavedSd.filter((p) => p.implementKg <= ceWeight);

    // Descending order: SD heavy → CE → SD light
    prescriptions.length = 0;
    prescriptions.push(...sdAboveComp, ...cePrescriptions, ...sdAtOrBelowComp);
  }

  // 5. SP throws: specific preparatory drills (last)
  const spExercises = exerciseComplex.filter((e) => e.classification === "SP");
  const spThrowExercises = spExercises.filter((e) =>
    isThrowLikeExercise(e.name),
  );

  if (spThrows > 0 && spThrowExercises.length > 0) {
    const throwsPerSpEx = Math.round(spThrows / spThrowExercises.length);

    for (const ex of spThrowExercises) {
      if (throwsPerSpEx <= 0) continue;
      const sets = Math.max(1, Math.round(throwsPerSpEx / 3));
      const reps = Math.max(1, Math.round(throwsPerSpEx / sets));

      prescriptions.push({
        implement: "med ball / varied",
        implementKg: 0,
        category: "SP",
        drillType: "OTHER",
        sets,
        repsPerSet: reps,
        restSeconds: restIntervals.SP_power,
        notes: ex.name,
      });
    }
  }

  return prescriptions;
}

function buildSdPrescriptions(
  exercises: ExerciseComplexEntry[],
  totalThrows: number,
  restSeconds: number,
  out: ThrowPrescription[],
): void {
  const throwsPerEx = Math.round(totalThrows / exercises.length);

  for (const ex of exercises) {
    if (throwsPerEx <= 0) continue;
    const sets = Math.max(1, Math.round(throwsPerEx / 4));
    const reps = Math.max(1, Math.round(throwsPerEx / sets));

    out.push({
      implement: ex.implementKg ? `${ex.implementKg}kg` : "varied",
      implementKg: ex.implementKg ?? 0,
      category: "SD",
      drillType: ex.drillType ?? "FULL_THROW",
      sets,
      repsPerSet: reps,
      restSeconds,
      notes: ex.name,
    });
  }
}

// ── Warmup Generation ───────────────────────────────────────────────

function generateWarmup(
  phase: TrainingPhase,
  dayType: string,
): WarmupPrescription[] {
  const warmups: WarmupPrescription[] = [
    { name: "General warmup (jog, bike, or jump rope)", duration: 5 },
    { name: "Dynamic stretching & mobility", duration: 5 },
  ];

  if (dayType === "A" || dayType === "C") {
    warmups.push({
      name: "Event-specific movement prep (winds, turns, approaches)",
      duration: 5,
    });
  }

  if (dayType === "B") {
    warmups.push({
      name: "Barbell warmup sets (empty bar)",
      duration: 5,
    });
  }

  if (dayType === "D") {
    warmups.push({
      name: "Competition simulation warmup (progressive throws)",
      duration: 5,
    });
  }

  return warmups;
}

// ── Helpers ─────────────────────────────────────────────────────────

function isThrowLikeExercise(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("shot forward") ||
    lower.includes("shot backward") ||
    lower.includes("med ball") ||
    lower.includes("throw") ||
    lower.includes("toss")
  );
}
