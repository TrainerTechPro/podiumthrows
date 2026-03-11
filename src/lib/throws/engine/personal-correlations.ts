// ── Gap 1: Evolving Personal Correlations ─────────────────────────────
// Blends athlete-specific Pearson correlations with population data,
// ramping personal weight from 0→1 over 5→30 data points.

import { pearsonCorrelation } from "../profile-utils";
import type { PersonalCorrelation, SessionExerciseRecord } from "./types";

// ── Configuration ───────────────────────────────────────────────────

const DEFAULT_MIN_DATA_POINTS = 5;
const DEFAULT_MAX_DATA_POINTS = 30;
const MIN_DATA_POINTS_FOR_CORRELATION = 3;

interface PersonalCorrelationConfig {
  minDataPoints?: number;
  maxDataPoints?: number;
}

interface PopulationCorrelation {
  exercise: string;
  correlation: number;
}

// ── Main Function ───────────────────────────────────────────────────

/**
 * Compute blended personal + population correlations for each exercise.
 *
 * For each exercise found in the session history:
 * 1. Build a binary usage vector (1 if used in that session, 0 otherwise)
 * 2. Build a performance delta vector (best mark vs 5-session rolling baseline)
 * 3. Compute Pearson correlation between usage and performance delta
 * 4. Blend with population correlation using confidence ramp
 */
export function computePersonalCorrelations(
  sessionHistory: SessionExerciseRecord[],
  populationCorrelations: PopulationCorrelation[],
  config?: PersonalCorrelationConfig,
): PersonalCorrelation[] {
  const minDP = config?.minDataPoints ?? DEFAULT_MIN_DATA_POINTS;
  const maxDP = config?.maxDataPoints ?? DEFAULT_MAX_DATA_POINTS;

  if (sessionHistory.length < MIN_DATA_POINTS_FOR_CORRELATION) return [];

  // Build rolling baseline: 5-session moving average of bestMark
  const marks = sessionHistory.map((s) => s.bestMark);
  const deltas = computePerformanceDeltas(marks);

  // Collect all unique exercises across all sessions
  const exerciseSet = new Set<string>();
  for (const session of sessionHistory) {
    for (const ex of session.exercises) {
      exerciseSet.add(ex.toLowerCase());
    }
  }

  const results: PersonalCorrelation[] = [];

  for (const exerciseLower of exerciseSet) {
    // Build binary usage vector
    const usageVector: number[] = [];
    let dataPoints = 0;
    for (const session of sessionHistory) {
      const used = session.exercises.some(
        (e) => e.toLowerCase() === exerciseLower,
      );
      usageVector.push(used ? 1 : 0);
      if (used) dataPoints++;
    }

    // Skip exercises with too few data points
    if (dataPoints < MIN_DATA_POINTS_FOR_CORRELATION) continue;

    // Compute Pearson correlation between usage and performance deltas
    const r = pearsonCorrelation(usageVector, deltas);
    const personalR = r ?? 0;

    // Find population correlation
    const popMatch = populationCorrelations.find(
      (p) => p.exercise.toLowerCase() === exerciseLower,
    );
    const populationR = popMatch?.correlation ?? 0;

    // Compute confidence and blended correlation
    const confidence = confidenceRamp(dataPoints, minDP, maxDP);
    const blendedR = blendCorrelation(personalR, populationR, confidence);

    results.push({
      exercise: exerciseLower,
      personalR,
      dataPoints,
      confidence,
      populationR,
      blendedR,
    });
  }

  return results;
}

// ── Helper Functions ────────────────────────────────────────────────

/**
 * Linear ramp from 0→1 between minDP and maxDP data points.
 * Below minDP: 0 (pure population). Above maxDP: 1 (pure personal).
 */
export function confidenceRamp(
  dataPoints: number,
  min: number = DEFAULT_MIN_DATA_POINTS,
  max: number = DEFAULT_MAX_DATA_POINTS,
): number {
  if (dataPoints <= min) return 0;
  if (dataPoints >= max) return 1;
  return (dataPoints - min) / (max - min);
}

/**
 * Blend personal and population correlations using confidence weight.
 * confidence=0 → pure population, confidence=1 → pure personal.
 */
export function blendCorrelation(
  personalR: number,
  populationR: number,
  confidence: number,
): number {
  return personalR * confidence + populationR * (1 - confidence);
}

/**
 * Compute performance deltas relative to a 5-session rolling baseline.
 * For each session: delta = bestMark - rollingAvg(previous 5 sessions).
 * First 5 sessions use available data for the rolling average.
 */
function computePerformanceDeltas(marks: number[]): number[] {
  const windowSize = 5;
  const deltas: number[] = [];

  for (let i = 0; i < marks.length; i++) {
    const windowStart = Math.max(0, i - windowSize);
    const window = marks.slice(windowStart, i);
    const baseline =
      window.length > 0
        ? window.reduce((a, b) => a + b, 0) / window.length
        : marks[i];
    deltas.push(marks[i] - baseline);
  }

  return deltas;
}
