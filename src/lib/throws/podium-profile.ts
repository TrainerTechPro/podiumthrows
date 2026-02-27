/**
 * Podium Throws — Profile Utilities
 *
 * Core logic for the Bondarchuk Athlete Profiling System:
 *   - isPodiumThrowsAthlete():  gatekeeper check
 *   - calculateDeficits():      KPI deficit engine
 *   - computeDistanceBand():    band helper
 *   - classifyStrengthRatio():  single-metric deficit classifier
 *   - syncAdaptationProfile():  copy ThrowsTyping → ThrowsProfile
 */

import type {
  ThrowsProfile,
  ThrowsKpiStandard,
  ThrowsTyping,
} from "@prisma/client";
import { classifyBand } from "./constants";
import type { EventCode, GenderCode } from "./constants";

// ── Types ────────────────────────────────────────────────────────────

export type DeficitLevel = "above" | "within" | "below" | "far_below";

export type DeficitType =
  | "heavy_implement"
  | "light_implement"
  | "strength"
  | "balanced"
  | "none";

export interface ImplementAnalysis {
  heavyRatio: number | null;    // heavy_mark / comp_mark
  lightRatio: number | null;    // light_mark / comp_mark
  heavyStatus: DeficitLevel | null;
  lightStatus: DeficitLevel | null;
}

export interface StrengthAnalysis {
  squat: DeficitLevel | null;
  bench: DeficitLevel | null;
  clean: DeficitLevel | null;
  snatch: DeficitLevel | null;
  // Worst (most deficient) of the four
  worstStatus: DeficitLevel | null;
}

export interface DeficitResult {
  primary: DeficitType;
  secondary: DeficitType;
  overallStatus: DeficitLevel;
  overPowered: boolean;          // strength ≥1 distance band above throw level
  dataInsufficient: boolean;     // not enough data to compute
  implements: ImplementAnalysis;
  strength: StrengthAnalysis;
}

export interface StrengthBenchmarks {
  squatKg?: number | null;
  benchKg?: number | null;
  cleanKg?: number | null;
  snatchKg?: number | null;
  ohpKg?: number | null;
  bodyWeightKg?: number | null;
}

// ── Constants ────────────────────────────────────────────────────────

/** How far below "min" ratio is classified as "far_below" */
const FAR_BELOW_MARGIN = 0.07;

/**
 * Over-powered threshold: if squat/BW ratio is ≥1.5× the distance band's
 * squatToBodyweightTypical AND the implement ratio is "below" or "far_below",
 * flag as over-powered.
 */
const _OVER_POWERED_STRENGTH_MULTIPLIER = 1.5;

// ── isPodiumThrowsAthlete ─────────────────────────────────────────────

/**
 * Returns true when the athlete has an active ThrowsProfile row.
 *
 * Client-side (React Query / SWR): pass the pre-fetched profile.
 * Server-side (API route): query the DB first.
 *
 * @example
 *   const profile = await prisma.throwsProfile.findUnique({ where: { athleteId } })
 *   if (isPodiumThrowsAthlete(profile)) { ... }
 */
export function isPodiumThrowsAthlete(
  profile: Pick<ThrowsProfile, "status"> | null | undefined
): boolean {
  return profile?.status === "active";
}

// ── computeDistanceBand ───────────────────────────────────────────────

/**
 * Derives the distance band string for a given PR.
 * Wrapper around the existing classifyBand() from constants.ts.
 */
export function computeDistanceBand(
  event: EventCode,
  gender: GenderCode,
  competitionPb: number
): string | null {
  return classifyBand(event, gender, competitionPb);
}

// ── classifyRatio ─────────────────────────────────────────────────────

/**
 * Classifies a single numeric ratio (actual / expected) against
 * the KPI standard thresholds for a given implement direction.
 *
 * @param ratio        - actual ratio (e.g. heavy_mark / comp_mark)
 * @param ratioMin     - minimum healthy ratio from KPI standard
 * @param ratioTypical - center of healthy range from KPI standard
 * @param farBelowMargin - distance below min to qualify as "far_below"
 */
export function classifyRatio(
  ratio: number,
  ratioMin: number,
  ratioTypical: number,
  farBelowMargin = FAR_BELOW_MARGIN
): DeficitLevel {
  const upperBound = ratioTypical * 1.05; // 5% above typical = "above"

  if (ratio >= upperBound) return "above";
  if (ratio >= ratioMin) return "within";
  if (ratio >= ratioMin - farBelowMargin) return "below";
  return "far_below";
}

/**
 * Classifies a strength-to-bodyweight ratio.
 *
 * @param actual   - athlete's actual ratio (lift_kg / body_weight_kg)
 * @param min      - minimum expected ratio from KPI standard
 * @param typical  - center of expected range
 */
export function classifyStrengthRatio(
  actual: number,
  min: number,
  typical: number
): DeficitLevel {
  const upper = typical * 1.10; // 10% above typical = "above" (over-powered territory)
  if (actual >= upper) return "above";
  if (actual >= min) return "within";
  if (actual >= min - FAR_BELOW_MARGIN) return "below";
  return "far_below";
}

// ── worstOf ───────────────────────────────────────────────────────────

const DEFICIT_ORDER: DeficitLevel[] = ["far_below", "below", "within", "above"];

function worstOf(...levels: (DeficitLevel | null)[]): DeficitLevel | null {
  let worst: DeficitLevel | null = null;
  for (const level of levels) {
    if (level === null) continue;
    if (worst === null) {
      worst = level;
      continue;
    }
    if (DEFICIT_ORDER.indexOf(level) < DEFICIT_ORDER.indexOf(worst)) {
      worst = level;
    }
  }
  return worst;
}

// ── calculateDeficits ────────────────────────────────────────────────

/**
 * Full Bondarchuk KPI deficit engine.
 *
 * Input:
 *   - competitionPb      — athlete's current competition PB (meters)
 *   - heavyImplementPr   — best mark with the heavy implement (meters)
 *   - lightImplementPr   — best mark with the light implement (meters)
 *   - strengthBenchmarks — { squatKg, benchKg, cleanKg, snatchKg, bodyWeightKg }
 *   - kpiStandard        — the ThrowsKpiStandard row for this band
 *
 * Output:
 *   DeficitResult with primary/secondary deficit classification,
 *   overPowered flag, and per-category analysis.
 *
 * Deficit logic:
 *   1. Classify heavy implement ratio → heavyStatus
 *   2. Classify light implement ratio → lightStatus
 *   3. Classify each strength ratio → strengthStatus (worst of all lifts)
 *   4. Primary deficit = the category with the "worst" classification
 *   5. Over-powered = strength "above" while implements "below"/"far_below"
 *   6. balanced = all categories "within" or "above"
 */
export function calculateDeficits(
  competitionPb: number,
  heavyImplementPr: number | null | undefined,
  lightImplementPr: number | null | undefined,
  strengthBenchmarks: StrengthBenchmarks | null | undefined,
  kpiStandard: ThrowsKpiStandard
): DeficitResult {
  const noData: DeficitResult = {
    primary: "none",
    secondary: "none",
    overallStatus: "within",
    overPowered: false,
    dataInsufficient: true,
    implements: {
      heavyRatio: null,
      lightRatio: null,
      heavyStatus: null,
      lightStatus: null,
    },
    strength: {
      squat: null,
      bench: null,
      clean: null,
      snatch: null,
      worstStatus: null,
    },
  };

  // Need at least the competition PB
  if (!competitionPb || competitionPb <= 0) return noData;

  // ── Implement analysis ─────────────────────────────────────────
  const heavyRatio =
    heavyImplementPr != null && heavyImplementPr > 0
      ? heavyImplementPr / competitionPb
      : null;
  const lightRatio =
    lightImplementPr != null && lightImplementPr > 0
      ? lightImplementPr / competitionPb
      : null;

  const heavyStatus = heavyRatio !== null
    ? classifyRatio(heavyRatio, kpiStandard.heavyImplRatioMin, kpiStandard.heavyImplRatioTypical)
    : null;

  const lightStatus = lightRatio !== null
    ? classifyRatio(lightRatio, kpiStandard.lightImplRatioMin, kpiStandard.lightImplRatioTypical)
    : null;

  // ── Strength analysis ──────────────────────────────────────────
  const bw = strengthBenchmarks?.bodyWeightKg;

  const squatStatus =
    bw && bw > 0 && strengthBenchmarks?.squatKg &&
    kpiStandard.squatToBodyweightMin && kpiStandard.squatToBodyweightTypical
      ? classifyStrengthRatio(
          strengthBenchmarks.squatKg / bw,
          kpiStandard.squatToBodyweightMin,
          kpiStandard.squatToBodyweightTypical
        )
      : null;

  const benchStatus =
    bw && bw > 0 && strengthBenchmarks?.benchKg &&
    kpiStandard.benchToBodyweightMin && kpiStandard.benchToBodyweightTypical
      ? classifyStrengthRatio(
          strengthBenchmarks.benchKg / bw,
          kpiStandard.benchToBodyweightMin,
          kpiStandard.benchToBodyweightTypical
        )
      : null;

  const cleanStatus =
    bw && bw > 0 && strengthBenchmarks?.cleanKg &&
    kpiStandard.cleanToBodyweightMin && kpiStandard.cleanToBodyweightTypical
      ? classifyStrengthRatio(
          strengthBenchmarks.cleanKg / bw,
          kpiStandard.cleanToBodyweightMin,
          kpiStandard.cleanToBodyweightTypical
        )
      : null;

  const snatchStatus =
    bw && bw > 0 && strengthBenchmarks?.snatchKg &&
    kpiStandard.snatchToBodyweightMin && kpiStandard.snatchToBodyweightTypical
      ? classifyStrengthRatio(
          strengthBenchmarks.snatchKg / bw,
          kpiStandard.snatchToBodyweightMin,
          kpiStandard.snatchToBodyweightTypical
        )
      : null;

  const strengthWorst = worstOf(squatStatus, benchStatus, cleanStatus, snatchStatus);

  // ── Insufficient data guard ────────────────────────────────────
  // We need at least one implement PR and one strength number to classify
  const hasImplementData = heavyStatus !== null || lightStatus !== null;
  const hasStrengthData = strengthWorst !== null;

  if (!hasImplementData && !hasStrengthData) {
    return { ...noData };
  }

  // ── Over-powered detection ─────────────────────────────────────
  // Strength is "above" threshold while both implement marks are "below"
  const implementsBelow =
    (heavyStatus === "below" || heavyStatus === "far_below") ||
    (lightStatus === "below" || lightStatus === "far_below");

  const strengthAbove = strengthWorst === "above";
  const overPowered = strengthAbove && implementsBelow;

  // ── Score each category (lower index = worse in DEFICIT_ORDER) ─
  function score(level: DeficitLevel | null): number {
    if (level === null) return 3; // treat null as "within" for ranking
    return DEFICIT_ORDER.indexOf(level);
  }

  const scores: { type: DeficitType; score: number }[] = [
    { type: "heavy_implement", score: score(heavyStatus) },
    { type: "light_implement", score: score(lightStatus) },
    { type: "strength", score: score(strengthWorst) },
  ];

  // Sort by worst-first (lowest score = worst)
  scores.sort((a, b) => a.score - b.score);

  // ── Classify primary + secondary ──────────────────────────────
  let primary: DeficitType = "balanced";
  let secondary: DeficitType = "none";

  const worstScore = scores[0].score;
  const withinIdx = DEFICIT_ORDER.indexOf("within");

  if (worstScore < withinIdx) {
    // Something is actually deficient
    primary = scores[0].type;
    // Secondary = second worst IF also below threshold
    if (scores[1].score < withinIdx) {
      secondary = scores[1].type;
    }
  }

  // ── Overall status ─────────────────────────────────────────────
  const allStatuses = [heavyStatus, lightStatus, strengthWorst].filter(
    (s): s is DeficitLevel => s !== null
  );
  const overallStatus: DeficitLevel =
    worstOf(...allStatuses) ?? "within";

  return {
    primary,
    secondary,
    overallStatus,
    overPowered,
    dataInsufficient: !hasImplementData,
    implements: {
      heavyRatio,
      lightRatio,
      heavyStatus,
      lightStatus,
    },
    strength: {
      squat: squatStatus,
      bench: benchStatus,
      clean: cleanStatus,
      snatch: snatchStatus,
      worstStatus: strengthWorst,
    },
  };
}

// ── syncAdaptationProfile ─────────────────────────────────────────────

/**
 * Maps ThrowsTyping classification fields to the ThrowsProfile
 * adaptation fields. Used when initially enrolling an athlete who
 * already has a ThrowsTyping record.
 *
 * Returns a partial ThrowsProfile update payload.
 */
export function syncAdaptationFromTyping(
  typing: Pick<
    ThrowsTyping,
    | "adaptationGroup"
    | "estimatedSessionsToForm"
    | "recommendedMethod"
  >
): {
  adaptationProfile: number | null;
  sessionsToForm: number | null;
  recommendedMethod: string | null;
} {
  return {
    adaptationProfile: typing.adaptationGroup ?? null,
    sessionsToForm: typing.estimatedSessionsToForm ?? null,
    recommendedMethod: typing.recommendedMethod ?? null,
  };
}

// ── Deficit label helpers ─────────────────────────────────────────────

export const DEFICIT_TYPE_LABELS: Record<DeficitType, string> = {
  heavy_implement: "Heavy Implement Deficit",
  light_implement: "Light Implement Deficit",
  strength: "Strength Deficit",
  balanced: "Balanced",
  none: "—",
};

export const DEFICIT_LEVEL_LABELS: Record<DeficitLevel, string> = {
  above: "Above Target",
  within: "Within Target",
  below: "Below Target",
  far_below: "Far Below Target",
};

export const DEFICIT_LEVEL_COLORS: Record<DeficitLevel, string> = {
  above: "text-emerald-600 dark:text-emerald-400",
  within: "text-blue-600 dark:text-blue-400",
  below: "text-amber-600 dark:text-amber-400",
  far_below: "text-red-600 dark:text-red-400",
};

export const DEFICIT_LEVEL_BG: Record<DeficitLevel, string> = {
  above: "bg-emerald-50 dark:bg-emerald-900/20",
  within: "bg-blue-50 dark:bg-blue-900/20",
  below: "bg-amber-50 dark:bg-amber-900/20",
  far_below: "bg-red-50 dark:bg-red-900/20",
};

// ── Training recommendation by deficit ────────────────────────────────

export const DEFICIT_TRAINING_RECS: Record<DeficitType, string> = {
  heavy_implement:
    "Prioritize heavy implement volume. Athlete is not generating sufficient force with above-competition weights. Increase heavy implement proportion to 35-45% of total throws.",
  light_implement:
    "Prioritize speed and rhythm development with light implements. Athlete lacks velocity transfer from light to competition weight. Increase light implement proportion to 30-40% with focus on technical speed.",
  strength:
    "Prioritize general-preparatory and specialized-preparatory strength work. Athlete's strength base is insufficient for their throwing level. Add 3-4 strength sessions per week with emphasis on squat and power clean.",
  balanced:
    "Training balance is appropriate for the competition level. Maintain current implement and strength distribution. Focus on technical refinement and competition-specific volume.",
  none: "Insufficient data to provide a recommendation. Record at least one set of implement PRs and strength test data.",
};
