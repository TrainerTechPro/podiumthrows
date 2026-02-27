// ── Implement Selection & Distribution ───────────────────────────────
// Distributes throw volume across available implements per phase config.
// Intersects IMPLEMENT_TABLES with athlete's EquipmentInventory.

import {
  COMPETITION_WEIGHTS,
  getImplementsForLevel,
} from "../constants";
import type { EventCode, GenderCode, TrainingPhase } from "../constants";
import { PHASE_IMPLEMENT_DIST } from "../constants";
import type {
  ImplementEntry,
  ImplementDistribution,
  ImplementAllocation,
} from "./types";

interface SelectImplementsParams {
  eventCode: EventCode;
  genderCode: GenderCode;
  competitionPr: number;
  phase: TrainingPhase;
  availableImplements: ImplementEntry[];
  totalThrows: number;
}

/**
 * Distributes throws across light/comp/heavy implements.
 * Only assigns to implements the athlete actually owns.
 * Falls back gracefully when athlete doesn't own a category.
 */
export function selectImplements(
  params: SelectImplementsParams,
): ImplementDistribution {
  const {
    eventCode,
    genderCode,
    competitionPr,
    phase,
    availableImplements,
    totalThrows,
  } = params;

  const compWeightKg = COMPETITION_WEIGHTS[eventCode][genderCode];
  const _levelData = getImplementsForLevel(eventCode, genderCode, competitionPr);

  // Phase-specific distribution percentages
  const phaseDist = PHASE_IMPLEMENT_DIST.find((d) => d.phase === phase);
  const lightPct = phaseDist?.lightPercent ?? 25;
  const compPct = phaseDist?.compPercent ?? 40;
  const heavyPct = phaseDist?.heavyPercent ?? 35;

  // Get available weights by category
  const _ownedWeights = new Set(availableImplements.map((i) => i.weightKg));

  // Classify owned implements into light/comp/heavy
  const lightOwned = availableImplements
    .filter((i) => i.weightKg < compWeightKg)
    .sort((a, b) => b.weightKg - a.weightKg); // heaviest light first

  const compOwned = availableImplements.filter(
    (i) => i.weightKg === compWeightKg,
  );

  const heavyOwned = availableImplements
    .filter((i) => i.weightKg > compWeightKg)
    .sort((a, b) => a.weightKg - b.weightKg); // lightest heavy first

  // Calculate throw counts per category
  let lightThrows = Math.round((totalThrows * lightPct) / 100);
  let compThrows = Math.round((totalThrows * compPct) / 100);
  let heavyThrows = Math.round((totalThrows * heavyPct) / 100);

  // Redistribute if athlete doesn't own a category
  if (lightOwned.length === 0) {
    compThrows += Math.round(lightThrows * 0.6);
    heavyThrows += Math.round(lightThrows * 0.4);
    lightThrows = 0;
  }
  if (heavyOwned.length === 0) {
    compThrows += Math.round(heavyThrows * 0.6);
    lightThrows += Math.round(heavyThrows * 0.4);
    heavyThrows = 0;
  }
  if (compOwned.length === 0) {
    // This is unusual but handle it
    lightThrows += Math.round(compThrows * 0.5);
    heavyThrows += Math.round(compThrows * 0.5);
    compThrows = 0;
  }

  // Build allocations
  const lightAllocations: ImplementAllocation[] = distributeAcross(
    lightOwned,
    lightThrows,
  );
  const heavyAllocations: ImplementAllocation[] = distributeAcross(
    heavyOwned,
    heavyThrows,
  );

  const compAllocation: ImplementAllocation = {
    weightKg: compWeightKg,
    label: `${compWeightKg}kg`,
    throwsCount: compThrows,
  };

  return {
    light: lightAllocations,
    comp: compAllocation,
    heavy: heavyAllocations,
  };
}

/** Evenly distribute throws across multiple implements of the same category. */
function distributeAcross(
  implements_: ImplementEntry[],
  totalThrows: number,
): ImplementAllocation[] {
  if (implements_.length === 0 || totalThrows === 0) return [];

  const perImpl = Math.floor(totalThrows / implements_.length);
  let remainder = totalThrows - perImpl * implements_.length;

  return implements_.map((impl) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      weightKg: impl.weightKg,
      label: `${impl.weightKg}kg`,
      throwsCount: perImpl + extra,
    };
  });
}

/**
 * Get the competition implement weight for an event/gender.
 */
export function getCompetitionWeight(
  eventCode: EventCode,
  genderCode: GenderCode,
): number {
  return COMPETITION_WEIGHTS[eventCode][genderCode];
}
