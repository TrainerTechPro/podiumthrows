// ── Session Generator ────────────────────────────────────────────────
// Builds a single training session from a day-type template.
// Distributes throws by CE/SD/SP/GP ratios, assigns implements by phase,
// adds strength if warranted, calculates loads from lifting PRs.

import { PHASE_RATIOS, REST_INTERVALS, COMPETITION_WEIGHTS, PHASE_IMPLEMENT_DIST } from "../constants";
import type { TrainingPhase } from "../constants";
import { selectStrength } from "./select-strength";
import type {
  GeneratedSession,
  ThrowPrescription,
  WarmupPrescription,
  ExerciseComplexEntry,
  SessionGenConfig,
} from "./types";

// ── Main Function ───────────────────────────────────────────────────

/**
 * Generate a single training session.
 *
 * Consumes the SessionGenConfig (day type, throws target, strength level,
 * exercise complex) and produces a fully prescribed session with throws,
 * strength work, and warmup.
 */
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
  } = config;

  // Target throws: midpoint of min/max
  const totalThrows = Math.round((throwsMin + throwsMax) / 2);

  // Session type
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
      })
    : [];

  // ── Generate warmup ──────────────────────────────────────────
  const warmup = generateWarmup(phase, dayType);

  // ── Estimate duration ────────────────────────────────────────
  const throwDuration = totalThrows * 1.5; // ~1.5 min per throw (including rest)
  const strengthDuration = strength.length * 8; // ~8 min per exercise
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
    totalThrowsTarget: totalThrows,
    estimatedDuration,
  };
}

// ── Throw Distribution ──────────────────────────────────────────────

/**
 * Generate throw prescriptions for a session.
 *
 * Applies proper Bondarchuk implement distribution: the phase determines what
 * percentage of throws should be light/comp/heavy, and SD exercises are
 * allocated across categories based on their implement weight.
 *
 * Session ordering follows the contrast method:
 *   1. CE — competition weight full throws (always first)
 *   2. SD heavy — overweight implements (strength stimulus)
 *   3. SD comp — competition weight drills
 *   4. SD light — underweight implements (speed stimulus)
 *   5. SP — specific preparatory drills (med ball, shot)
 *
 * This prevents the "light to heavy" anti-pattern and provides proper
 * neuromuscular contrast within the session.
 */
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

  // Get competition weight for this event/gender
  const compWeight =
    COMPETITION_WEIGHTS[programConfig.eventCode as keyof typeof COMPETITION_WEIGHTS]?.[
      programConfig.genderCode as "M" | "F"
    ] ?? 7.26;

  // Get phase-specific implement distribution percentages
  const phaseDist = PHASE_IMPLEMENT_DIST.find((d) => d.phase === phase);
  const lightPct = phaseDist?.lightPercent ?? 25;
  const compPct = phaseDist?.compPercent ?? 40;
  const heavyPct = phaseDist?.heavyPercent ?? 35;

  // Distribute throws by classification ratio
  const ceThrows = Math.round((totalThrows * ratios.CE) / 100);
  const sdThrows = Math.round((totalThrows * ratios.SD) / 100);
  const spThrows = Math.round((totalThrows * ratios.SP) / 100);
  // GP doesn't get throws (it's strength work)

  // ── Classify SD exercises by implement weight ──────────────────
  const sdExercises = exerciseComplex.filter((e) => e.classification === "SD");
  const sdHeavy = sdExercises.filter((e) => (e.implementKg ?? 0) > compWeight);
  const sdComp = sdExercises.filter((e) => (e.implementKg ?? 0) === compWeight);
  const sdLight = sdExercises.filter(
    (e) => e.implementKg !== undefined && e.implementKg > 0 && e.implementKg < compWeight,
  );
  const sdUnknown = sdExercises.filter(
    (e) => e.implementKg === undefined || e.implementKg === 0,
  );

  // ── Distribute SD throws across weight categories ──────────────
  // CE throws are always comp weight, so the remaining throw volume (SD)
  // is distributed using phase implement percentages.
  const sdTotalForDist = sdThrows;
  let sdHeavyThrows = Math.round((sdTotalForDist * heavyPct) / 100);
  let sdCompThrows = Math.round((sdTotalForDist * compPct) / 100);
  let sdLightThrows = Math.round((sdTotalForDist * lightPct) / 100);

  // Redistribute if athlete has no exercises in a category
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

  // Unknown-weight SD exercises get remaining throws distributed evenly
  const sdUnknownThrows = sdUnknown.length > 0
    ? Math.round(sdTotalForDist * 0.1) // 10% for unknown, pulled from comp
    : 0;
  if (sdUnknownThrows > 0) {
    sdCompThrows = Math.max(0, sdCompThrows - sdUnknownThrows);
  }

  const prescriptions: ThrowPrescription[] = [];

  // ── 1. CE throws: competition weight full throws (always first) ──
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

  // ── 2. SD heavy: overweight implements (contrast: heavy after comp) ──
  if (sdHeavyThrows > 0 && sdHeavy.length > 0) {
    buildSdPrescriptions(sdHeavy, sdHeavyThrows, restIntervals.SD, prescriptions);
  }

  // ── 3. SD comp: competition weight drills ────────────────────────
  if (sdCompThrows > 0 && sdComp.length > 0) {
    buildSdPrescriptions(sdComp, sdCompThrows, restIntervals.SD, prescriptions);
  }

  // ── 4. SD light: underweight implements (speed contrast) ─────────
  if (sdLightThrows > 0 && sdLight.length > 0) {
    buildSdPrescriptions(sdLight, sdLightThrows, restIntervals.SD, prescriptions);
  }

  // ── 4b. SD unknown: exercises without a specific implement ───────
  if (sdUnknownThrows > 0 && sdUnknown.length > 0) {
    buildSdPrescriptions(sdUnknown, sdUnknownThrows, restIntervals.SD, prescriptions);
  }

  // ── 5. SP throws: specific preparatory drills (last) ─────────────
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

/** Build SD prescriptions for a group of exercises with allocated throw count */
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

/** Check if an SP exercise involves throwing motions (vs pure strength) */
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
