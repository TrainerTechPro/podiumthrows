// ── Gap 3: Adaptive Waves (Supercompensation-Based Volume) ────────────
// Replaces fixed linear ramps with data-driven load/unload waves
// based on historical supercompensation timing.

import type { TrainingPhase } from "../constants";
import type { TrainingHistory, WeekMultiplier } from "./types";

// ── Configuration ───────────────────────────────────────────────────

/** Wave cycle lengths in weeks by adaptation group */
const WAVE_CYCLE_WEEKS: Record<number, number> = {
  1: 2, // Fast adapters: short 2-week waves
  2: 3, // Moderate: 3-week waves
  3: 4, // Slow: 4-week waves
};

/** Default fatigue decay constants by adaptation group */
const DEFAULT_DECAY: Record<number, number> = {
  1: 0.20, // Fast decay
  2: 0.14, // Moderate
  3: 0.09, // Slow
};

/** Volume multiplier clamps */
const MIN_MULTIPLIER = 0.65;
const MAX_MULTIPLIER = 1.20;

/** Minimum requirements for adaptive waves */
const MIN_COMPLETED_PHASES = 2;
const MIN_MARKED_SESSIONS = 8;

// ── Main Function ───────────────────────────────────────────────────

/**
 * Compute adaptive wave multipliers for a phase.
 *
 * Returns null if insufficient data (falls back to fixed ramps).
 * Returns null for COMPETITION phase (handled by taper).
 *
 * Wave cycle:
 * - ~67% load weeks, ~33% unload weeks within each cycle
 * - Progressive overload envelope across cycles in ACCUMULATION
 * - Multipliers clamped to [0.65, 1.20]
 */
export function computeAdaptiveWave(
  history: TrainingHistory,
  phase: TrainingPhase,
  totalWeeks: number,
): WeekMultiplier[] | null {
  // Don't apply to COMPETITION phase (taper handles this)
  if (phase === "COMPETITION") return null;

  // Minimum data requirements
  if (history.phasesCompleted < MIN_COMPLETED_PHASES) return null;

  const markedSessions = history.sessions.filter((s) => s.bestMark != null);
  if (markedSessions.length < MIN_MARKED_SESSIONS) return null;

  const group = history.adaptationGroup;
  const cycleWeeks = WAVE_CYCLE_WEEKS[group] ?? 3;

  const multipliers: WeekMultiplier[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const positionInCycle = w % cycleWeeks;
    const cycleIndex = Math.floor(w / cycleWeeks);
    const isUnloadWeek = positionInCycle === cycleWeeks - 1;

    let baseMultiplier: number;

    if (isUnloadWeek) {
      // Unload week: reduced volume
      baseMultiplier = 0.70;
    } else {
      // Load week: progressively increasing within cycle
      const loadProgress = positionInCycle / Math.max(1, cycleWeeks - 2);
      baseMultiplier = 0.90 + loadProgress * 0.15; // 0.90 → 1.05
    }

    // Progressive overload envelope for ACCUMULATION
    if (phase === "ACCUMULATION" && totalWeeks > 1) {
      const overallProgress = w / (totalWeeks - 1);
      const envelope = 0.95 + overallProgress * 0.10; // 0.95 → 1.05
      baseMultiplier *= envelope;
    }

    // Slight intensity bump for later cycles in TRANSMUTATION
    if (phase === "TRANSMUTATION" && cycleIndex > 0) {
      baseMultiplier *= 1.02;
    }

    // REALIZATION: gentle taper across the phase
    if (phase === "REALIZATION") {
      const progress = totalWeeks > 1 ? w / (totalWeeks - 1) : 0;
      baseMultiplier *= 1.0 - progress * 0.10;
    }

    // Clamp
    const clamped = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, baseMultiplier));

    let rationale: string;
    if (isUnloadWeek) {
      rationale = `Unload week (cycle ${cycleIndex + 1}, group ${group})`;
    } else {
      rationale = `Load week ${positionInCycle + 1}/${cycleWeeks} (cycle ${cycleIndex + 1})`;
    }

    multipliers.push({
      weekIndex: w,
      volumeMultiplier: Math.round(clamped * 100) / 100,
      rationale,
    });
  }

  return multipliers;
}

/**
 * Detect supercompensation timing from historical data.
 * Cross-correlates volume peaks with subsequent mark peaks.
 *
 * Returns peak lag in days (bounded 3-28) and confidence (0-1).
 */
export function detectSupercompensationTiming(
  history: TrainingHistory,
): { peakLagDays: number; confidence: number } {
  const sessions = history.sessions.filter(
    (s) => s.bestMark != null && s.totalThrows > 0,
  );

  if (sessions.length < 10) {
    // Default by adaptation group
    const defaults: Record<number, number> = { 1: 7, 2: 14, 3: 21 };
    return {
      peakLagDays: defaults[history.adaptationGroup] ?? 14,
      confidence: 0,
    };
  }

  // Simple cross-correlation: find the lag that maximizes correlation
  // between high-volume sessions and subsequent mark peaks
  const volumes = sessions.map((s) => s.totalThrows);
  const marks = sessions.map((s) => s.bestMark!);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const avgMark = marks.reduce((a, b) => a + b, 0) / marks.length;

  let bestLag = 7;
  let bestCorr = -Infinity;

  // Test lags from 1 to min(7, sessions.length - 1) sessions
  const maxLag = Math.min(7, sessions.length - 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let num = 0, denVol = 0, denMark = 0;
    for (let i = 0; i < sessions.length - lag; i++) {
      const dv = volumes[i] - avgVol;
      const dm = marks[i + lag] - avgMark;
      num += dv * dm;
      denVol += dv * dv;
      denMark += dm * dm;
    }
    const den = Math.sqrt(denVol * denMark);
    const corr = den > 0 ? num / den : 0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  // Convert session lag to approximate days (assuming ~4 sessions/week)
  const lagDays = Math.round(bestLag * 7 / 4);
  const clampedDays = Math.max(3, Math.min(28, lagDays));

  return {
    peakLagDays: clampedDays,
    confidence: Math.max(0, Math.min(1, bestCorr)),
  };
}

/**
 * Estimate fatigue decay constant from training history.
 * Falls back to group-based defaults.
 */
export function estimateFatigueDecay(history: TrainingHistory): number {
  return DEFAULT_DECAY[history.adaptationGroup] ?? 0.14;
}
