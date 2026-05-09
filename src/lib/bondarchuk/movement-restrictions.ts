/**
 * Phase C.3 — Movement-restriction-aware exercise filtering.
 *
 * Pure helper that classifies exercise names by the four movement
 * capabilities tracked on `AthleteProfile.movementRestrictions`:
 * fullOverhead, fullHipRotation, deepSquat, singleLegStability.
 *
 * Strategy: regex keyword matching against the exercise name. The keyword
 * set targets common throws/strength exercises and is intentionally
 * conservative — we'd rather flag a borderline exercise and let the coach
 * dismiss than miss a real conflict. Future refinements can fold in
 * Exercise.equipment or ExerciseLibrary.muscleGroup metadata when the
 * caller has that available.
 *
 * UI consumers (athlete-scoped surfaces only — plan-template surfaces
 * have no athlete in context):
 *   const violations = getExerciseViolations(exercise.name, restrictions);
 *   if (violations.length > 0) renderRestrictionBadge(violations);
 *
 * Restriction semantics: in `MovementRestrictionsData`, `true` means the
 * athlete CAN perform the movement; `false` means they cannot. So we
 * "disable" capabilities marked `false` and intersect with the exercise's
 * required capabilities.
 */

import type { MovementRestrictionsData } from "@/app/(dashboard)/athlete/profile/_types";

export type MovementCapability =
  | "fullOverhead"
  | "fullHipRotation"
  | "deepSquat"
  | "singleLegStability";

const ALL_CAPABILITIES: readonly MovementCapability[] = [
  "fullOverhead",
  "fullHipRotation",
  "deepSquat",
  "singleLegStability",
] as const;

/**
 * Regex map: exercise name keywords that imply a given capability is
 * required. Word boundaries are used to avoid false hits (e.g., "press"
 * inside "pressure" — not currently an issue, but safer).
 *
 * Any exercise whose name matches one or more of a capability's patterns
 * is treated as requiring that capability.
 *
 * Snatch/clean exclusion: "Snatch Pull" / "Clean Pull" / "Snatch Grip"
 * variants are pulling or grip-width modifiers — they finish below the
 * catch and don't require overhead reception or a deep squat. The
 * negative lookahead skips them. Calibrated against actual seed exercise
 * names on 2026-05-09.
 */
const SNATCH_CLEAN_EXCLUSION = String.raw`(?!\s+(pull|high pull|grip))`;

const CAPABILITY_KEYWORDS: Record<MovementCapability, RegExp[]> = {
  fullOverhead: [
    /\boverhead\b/i,
    new RegExp(String.raw`\bsnatch\b${SNATCH_CLEAN_EXCLUSION}`, "i"),
    /\bjerk\b/i, // push/split/squat jerk
    /\bpullover\b/i,
    /\bpush press\b/i, // explicit — "press" alone is ambiguous (bench press, leg press)
    /\bstrict press\b/i,
    /\bmilitary press\b/i,
    /\bshoulder press\b/i,
    /\bthruster\b/i, // front squat → overhead
    /\bturkish ?get ?up\b/i,
    /\bwindmill\b/i,
  ],
  fullHipRotation: [
    /\brotation(al)?\b/i,
    /\btwist\b/i, // russian twist, oblique twist
    /\bhip ?turn\b/i,
    /\bwood ?chop\b/i,
    /\bcable ?chop\b/i,
    /\bmed(icine)?[- ]?ball.*throw\b/i, // rotational med-ball work
    /\bscoop ?toss\b/i,
    /\bshot put\b/i, // throwing itself requires hip rotation
    /\bdiscus\b/i,
    /\bhammer throw\b/i,
  ],
  deepSquat: [
    /\bback squat\b/i,
    /\bfront squat\b/i,
    /\boverhead squat\b/i,
    /\bgoblet squat\b/i,
    /\bbox squat\b/i,
    /\bzercher squat\b/i,
    /\bfull squat\b/i,
    /\bair squat\b/i,
    /\bbulgarian\b/i, // bulgarian split squat — deep + single-leg
    /\bpistol\b/i,
    new RegExp(String.raw`\bclean\b${SNATCH_CLEAN_EXCLUSION}`, "i"), // power/hang clean catch is in the rack; clean pull doesn't catch at all
    new RegExp(String.raw`\bsnatch\b${SNATCH_CLEAN_EXCLUSION}`, "i"),
    /\bthruster\b/i,
  ],
  singleLegStability: [
    /\bsingle ?leg\b/i,
    /\bone ?leg\b/i,
    /\bsplit squat\b/i,
    /\blunge\b/i, // walking, reverse, lateral, jumping
    /\bpistol\b/i,
    /\bbulgarian\b/i,
    /\bstep ?up\b/i,
    /\bskater(s)?\b/i,
    /\bcurtsy\b/i,
    /\bsl[- ]?rdl\b/i, // SL-RDL or SL RDL shorthand
  ],
};

/**
 * Returns the set of capabilities required by an exercise based on its
 * name. Each capability appears at most once in the result.
 *
 * This is a conservative classifier — names without matching keywords
 * return `[]` and are treated as having no movement requirements.
 */
export function getRequiredCapabilities(exerciseName: string): MovementCapability[] {
  if (!exerciseName) return [];
  const result: MovementCapability[] = [];
  for (const capability of ALL_CAPABILITIES) {
    const patterns = CAPABILITY_KEYWORDS[capability];
    if (patterns.some((re) => re.test(exerciseName))) {
      result.push(capability);
    }
  }
  return result;
}

/**
 * Returns the capabilities the athlete CANNOT perform, based on their
 * `MovementRestrictionsData`. A capability flag of `false` in the data
 * means the athlete is restricted from that movement.
 *
 * `null` input → `[]` (no known restrictions; treat as unrestricted).
 */
export function getDisabledCapabilities(
  restrictions: MovementRestrictionsData | null
): MovementCapability[] {
  if (!restrictions) return [];
  const result: MovementCapability[] = [];
  for (const capability of ALL_CAPABILITIES) {
    if (restrictions[capability] === false) {
      result.push(capability);
    }
  }
  return result;
}

/**
 * Returns the capabilities required by `exerciseName` that the athlete
 * cannot perform. An empty array means the exercise is safe (or the
 * athlete has no recorded restrictions).
 *
 * This is the primary integration point for UI consumers: render a
 * warning badge whenever this returns a non-empty array.
 */
export function getExerciseViolations(
  exerciseName: string,
  restrictions: MovementRestrictionsData | null
): MovementCapability[] {
  if (!restrictions) return [];
  const required = getRequiredCapabilities(exerciseName);
  if (required.length === 0) return [];
  const disabled = new Set(getDisabledCapabilities(restrictions));
  return required.filter((c) => disabled.has(c));
}
