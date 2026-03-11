// ── Gap 2: Intra-Session Micro-Contrast (PAP) ─────────────────────────
// Interleaves heavy/light implements within SD blocks during
// TRANSMUTATION and REALIZATION for post-activation potentiation.

import type { TrainingPhase } from "../constants";
import type {
  ThrowPrescription,
  ContrastPattern,
  ContrastConfig,
} from "./types";
import { PAP_REST_SECONDS } from "./constants";

// ── Main Function ───────────────────────────────────────────────────

/**
 * Apply contrast pattern to SD prescriptions for PAP effect.
 *
 * Key constraints:
 * - Only applies during TRANSMUTATION and REALIZATION phases
 * - Only applies when SD block has ≥2 unique implement weights
 * - Macro ordering CE→SD→SP is preserved (PAP only reorders WITHIN SD)
 * - Total throw count is unchanged
 */
export function applyContrastPattern(
  sdPrescriptions: ThrowPrescription[],
  phase: TrainingPhase,
  config?: ContrastConfig,
): ThrowPrescription[] {
  // Pass-through for ACCUMULATION/COMPETITION
  if (phase === "ACCUMULATION" || phase === "COMPETITION") {
    return sdPrescriptions;
  }

  // Get unique implement weights
  const uniqueWeights = new Set(
    sdPrescriptions
      .filter((p) => p.implementKg > 0)
      .map((p) => p.implementKg),
  );

  // Need ≥2 distinct weights for contrast
  if (uniqueWeights.size < 2) return sdPrescriptions;

  const pattern = config?.pattern ?? selectPattern(phase, uniqueWeights.size);
  const papRest = PAP_REST_SECONDS[phase] ?? 420;

  switch (pattern) {
    case "HEAVY_LIGHT":
      return applyHeavyLight(sdPrescriptions, papRest);
    case "WAVE":
      return applyWave(sdPrescriptions, papRest);
    case "COMP_HEAVY":
      return applyCompHeavy(sdPrescriptions, papRest);
    default:
      return sdPrescriptions;
  }
}

/**
 * Select the best contrast pattern for the given phase and implement count.
 */
export function selectPattern(
  phase: TrainingPhase,
  implementCount: number,
): ContrastPattern {
  if (phase === "TRANSMUTATION") return "HEAVY_LIGHT";
  // REALIZATION
  if (implementCount >= 3) return "WAVE";
  return "COMP_HEAVY";
}

// ── Pattern Implementations ─────────────────────────────────────────

/**
 * HEAVY_LIGHT: Alternate heavy/light chunks.
 * e.g. 9kg×3 → 7.26kg×3 → 9kg×3 → 7.26kg×3
 */
function applyHeavyLight(
  prescriptions: ThrowPrescription[],
  papRest: number,
): ThrowPrescription[] {
  const sorted = [...prescriptions].sort(
    (a, b) => b.implementKg - a.implementKg,
  );

  // Split into heavy (above median) and light (at/below median)
  const weights = sorted.map((p) => p.implementKg).filter((w) => w > 0);
  const medianWeight = weights[Math.floor(weights.length / 2)] ?? 0;
  const heavy = sorted.filter((p) => p.implementKg > medianWeight);
  const light = sorted.filter((p) => p.implementKg <= medianWeight);

  if (heavy.length === 0 || light.length === 0) return prescriptions;

  // Split each group into 2-set chunks, interleave
  const heavyChunks = splitIntoChunks(heavy);
  const lightChunks = splitIntoChunks(light);

  const interleaved: ThrowPrescription[] = [];
  const maxLen = Math.max(heavyChunks.length, lightChunks.length);
  let contrastGroup = 1;

  for (let i = 0; i < maxLen; i++) {
    if (i < heavyChunks.length) {
      for (const p of heavyChunks[i]) {
        interleaved.push({
          ...p,
          papRestSeconds: i > 0 ? papRest : undefined,
          contrastGroup: contrastGroup,
        });
      }
    }
    if (i < lightChunks.length) {
      for (const p of lightChunks[i]) {
        interleaved.push({
          ...p,
          papRestSeconds: papRest,
          contrastGroup: contrastGroup,
        });
      }
    }
    contrastGroup++;
  }

  return interleaved;
}

/**
 * WAVE: Descending reset.
 * e.g. 9kg→8kg→7.26kg → 9kg→8kg→7.26kg
 */
function applyWave(
  prescriptions: ThrowPrescription[],
  papRest: number,
): ThrowPrescription[] {
  // Sort by weight descending (heaviest first)
  const sorted = [...prescriptions].sort(
    (a, b) => b.implementKg - a.implementKg,
  );

  // One wave = one full pass through all weights descending
  // With limited prescriptions, we do 2 waves if possible
  const totalSets = sorted.reduce((sum, p) => sum + p.sets, 0);
  const targetWaves = totalSets >= 6 ? 2 : 1;

  if (targetWaves === 1) {
    return sorted.map((p, i) => ({
      ...p,
      papRestSeconds: i > 0 ? papRest : undefined,
      contrastGroup: 1,
    }));
  }

  // Split each prescription's sets roughly in half for 2 waves
  const result: ThrowPrescription[] = [];
  let contrastGroup = 1;

  for (let wave = 0; wave < targetWaves; wave++) {
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const waveSets =
        wave === 0
          ? Math.ceil(p.sets / targetWaves)
          : Math.floor(p.sets / targetWaves);
      if (waveSets <= 0) continue;

      result.push({
        ...p,
        sets: waveSets,
        papRestSeconds: wave > 0 || i > 0 ? papRest : undefined,
        contrastGroup,
      });
    }
    contrastGroup++;
  }

  return result;
}

/**
 * COMP_HEAVY: Comp opener → heavy potentiation → comp closer.
 */
function applyCompHeavy(
  prescriptions: ThrowPrescription[],
  papRest: number,
): ThrowPrescription[] {
  const sorted = [...prescriptions].sort(
    (a, b) => b.implementKg - a.implementKg,
  );
  const weights = [...new Set(sorted.map((p) => p.implementKg))].sort(
    (a, b) => b - a,
  );

  if (weights.length < 2) return prescriptions;

  const heaviestWeight = weights[0];
  const lightestWeight = weights[weights.length - 1];

  const heavy = sorted.filter((p) => p.implementKg === heaviestWeight);
  const comp = sorted.filter((p) => p.implementKg === lightestWeight);
  const mid = sorted.filter(
    (p) =>
      p.implementKg !== heaviestWeight && p.implementKg !== lightestWeight,
  );

  const result: ThrowPrescription[] = [];

  // Opener: lighter/comp weight
  const openerSets = Math.max(1, Math.ceil(comp.reduce((s, p) => s + p.sets, 0) / 2));
  for (const p of comp) {
    const sets = Math.min(p.sets, openerSets);
    if (sets > 0) {
      result.push({ ...p, sets, contrastGroup: 1 });
    }
  }

  // Heavy potentiation
  for (const p of heavy) {
    result.push({ ...p, papRestSeconds: papRest, contrastGroup: 2 });
  }

  // Mid-weight (if any)
  for (const p of mid) {
    result.push({ ...p, papRestSeconds: papRest, contrastGroup: 3 });
  }

  // Closer: remaining comp sets
  for (const p of comp) {
    const remainingSets = Math.max(0, p.sets - openerSets);
    if (remainingSets > 0) {
      result.push({
        ...p,
        sets: remainingSets,
        papRestSeconds: papRest,
        contrastGroup: 4,
      });
    }
  }

  return result;
}

// ── Utility ─────────────────────────────────────────────────────────

/**
 * Split prescriptions into chunks of ~2 sets each for interleaving.
 */
function splitIntoChunks(
  prescriptions: ThrowPrescription[],
): ThrowPrescription[][] {
  const chunks: ThrowPrescription[][] = [];

  for (const p of prescriptions) {
    if (p.sets <= 2) {
      chunks.push([p]);
    } else {
      // Split into chunks of 2 sets
      let remaining = p.sets;
      while (remaining > 0) {
        const chunkSets = Math.min(2, remaining);
        chunks.push([{ ...p, sets: chunkSets }]);
        remaining -= chunkSets;
      }
    }
  }

  return chunks;
}
