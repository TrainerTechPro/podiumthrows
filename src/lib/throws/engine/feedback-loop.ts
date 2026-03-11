// ── Gap 5: Mid-Program Feedback Loop ──────────────────────────────────
// Compares predicted vs actual progress using logarithmic growth,
// scores complex effectiveness, attributes deficits, recommends
// volume adjustments.

import { linearSlope } from "../profile-utils";
import type {
  FeedbackAnalysis,
  ComplexHistory,
  ComplexScore,
  VolumeAdjustment,
  DeficitAttribution,
  LogFitResult,
  FeedbackLoopResult,
  TrendDirection,
} from "./types";

// ── Configuration ───────────────────────────────────────────────────

const MIN_MARKS_FOR_PREDICTION = 3;
const DEVIATION_THRESHOLD_BEHIND = -0.02;  // 2% behind predicted
const DEVIATION_THRESHOLD_AHEAD = 0.02;    // 2% ahead of predicted
const _HIGH_RPE_THRESHOLD = 8.0;
const LOW_ADHERENCE_THRESHOLD = 0.80;
const HIGH_VARIANCE_THRESHOLD = 0.08;      // 8% coefficient of variation
const SLOPE_THRESHOLD = 0.3;               // slope > 0.3 = RISING, < -0.3 = FALLING

// ── Logarithmic Growth Fit ──────────────────────────────────────────

/**
 * Fit a logarithmic growth model to mark progression.
 *
 * predicted = a × ln(session + 1) + b
 *
 * Uses least-squares fit. Falls back to last known mark if <3 data points.
 */
export function fitLogarithmicGrowth(
  marks: number[],
  sessionIndices?: number[],
): LogFitResult {
  if (marks.length === 0) {
    return { a: 0, b: 0, rSquared: 0, predictedMark: 0 };
  }

  if (marks.length < MIN_MARKS_FOR_PREDICTION) {
    const lastMark = marks[marks.length - 1];
    return { a: 0, b: lastMark, rSquared: 0, predictedMark: lastMark };
  }

  const n = marks.length;
  const indices = sessionIndices ?? marks.map((_, i) => i);

  // Transform x to ln(session + 1)
  const lnX = indices.map((i) => Math.log(i + 1));
  const y = marks;

  // Least-squares: y = a*lnX + b
  const meanLnX = lnX.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (lnX[i] - meanLnX) * (y[i] - meanY);
    den += (lnX[i] - meanLnX) ** 2;
  }

  const a = den > 0 ? num / den : 0;
  const b = meanY - a * meanLnX;

  // R² calculation
  const ssRes = y.reduce(
    (sum, yi, i) => sum + (yi - (a * lnX[i] + b)) ** 2,
    0,
  );
  const ssTot = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Predict next session
  const nextIndex = indices[indices.length - 1] + 1;
  const predictedMark = a * Math.log(nextIndex + 1) + b;

  return { a, b, rSquared: Math.max(0, rSquared), predictedMark };
}

// ── Feedback Analysis ───────────────────────────────────────────────

interface AnalyzeFeedbackParams {
  marks: number[];
  predictedMark: number;
  prescribedThrows?: number;
  actualThrows?: number;
  rpeValues?: number[];
  readinessScores?: number[];
  sorenessScores?: number[];
}

/**
 * Analyze feedback comparing predicted vs actual performance.
 */
export function analyzeFeedback(params: AnalyzeFeedbackParams): FeedbackAnalysis {
  const {
    marks,
    predictedMark,
    prescribedThrows,
    actualThrows,
    rpeValues,
    readinessScores,
    sorenessScores,
  } = params;

  const actualMark = marks.length > 0 ? marks[marks.length - 1] : 0;
  const deviation = predictedMark > 0 ? (actualMark - predictedMark) / predictedMark : 0;

  // Mark variance: coefficient of variation
  const meanMark = marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : 0;
  const variance = marks.length > 1
    ? Math.sqrt(marks.reduce((sum, m) => sum + (m - meanMark) ** 2, 0) / (marks.length - 1))
    : 0;
  const markVariance = meanMark > 0 ? variance / meanMark : 0;

  // Volume adherence
  const volumeAdherence =
    prescribedThrows && actualThrows && prescribedThrows > 0
      ? actualThrows / prescribedThrows
      : 1.0;

  // Trends
  const rpeTrend = classifyTrend(rpeValues);
  const readinessTrend = classifyTrend(readinessScores);
  const sorenessTrend = classifyTrend(sorenessScores);

  return {
    predictedMark,
    actualMark,
    deviation,
    markVariance,
    volumeAdherence,
    rpeTrend,
    readinessTrend,
    sorenessTrend,
  };
}

// ── Complex Effectiveness ───────────────────────────────────────────

/**
 * Score effectiveness of exercise complexes.
 *
 * effectiveness = normalizedImprovement × avgAdherence × rpeStability
 */
export function scoreComplexEffectiveness(
  complexHistories: ComplexHistory[],
): ComplexScore[] {
  if (complexHistories.length === 0) return [];

  const scores: ComplexScore[] = complexHistories.map((ch) => {
    // Normalized improvement
    const improvement =
      ch.startMark > 0 ? (ch.endMark - ch.startMark) / ch.startMark : 0;
    const normalizedImprovement = Math.max(0, Math.min(1, improvement * 10 + 0.5));

    // RPE stability (lower RPE = better)
    const rpeStability = ch.avgRpe > 0 ? Math.max(0, 1 - (ch.avgRpe - 6) / 4) : 0.5;

    // Adherence factor
    const adherenceFactor = Math.min(1, ch.avgAdherence);

    const effectiveness = normalizedImprovement * adherenceFactor * rpeStability;

    return {
      complexId: ch.complexId,
      effectiveness: Math.round(effectiveness * 100) / 100,
      markImprovement: improvement,
      rank: 0, // filled below
    };
  });

  // Rank by effectiveness
  scores.sort((a, b) => b.effectiveness - a.effectiveness);
  scores.forEach((s, i) => { s.rank = i + 1; });

  return scores;
}

// ── Volume Adjustment ───────────────────────────────────────────────

/**
 * Compute volume adjustment based on feedback analysis.
 *
 * Rules:
 * - Behind + rising RPE → 0.80 (overtraining reduction)
 * - Behind + manageable RPE → 1.10 (volume increase)
 * - Ahead → 0.90 (efficiency gain)
 * - Rising soreness + falling readiness → 0.80 (deload)
 */
export function computeVolumeAdjustment(
  feedback: FeedbackAnalysis,
): VolumeAdjustment {
  // Deload check: rising soreness + falling readiness
  if (
    feedback.sorenessTrend === "RISING" &&
    feedback.readinessTrend === "FALLING"
  ) {
    return {
      multiplier: 0.80,
      reason: "Rising soreness with falling readiness indicates accumulated fatigue",
      category: "DELOAD",
    };
  }

  // Behind predicted
  if (feedback.deviation < DEVIATION_THRESHOLD_BEHIND) {
    if (feedback.rpeTrend === "RISING") {
      return {
        multiplier: 0.80,
        reason: "Behind predicted with rising RPE — reduce volume to manage overtraining",
        category: "OVERTRAINING",
      };
    }
    return {
      multiplier: 1.10,
      reason: "Behind predicted with manageable RPE — increase volume for more stimulus",
      category: "UNDERTRAINING",
    };
  }

  // Ahead of predicted
  if (feedback.deviation > DEVIATION_THRESHOLD_AHEAD) {
    return {
      multiplier: 0.90,
      reason: "Ahead of predicted marks — optimize with slight volume reduction",
      category: "EFFICIENCY",
    };
  }

  // On track
  return {
    multiplier: 1.0,
    reason: "Performance tracking predicted growth — maintain current volume",
    category: "MAINTAIN",
  };
}

// ── Deficit Attribution ─────────────────────────────────────────────

/**
 * Attribute performance deficits to root causes.
 */
export function attributeDeficit(
  feedback: FeedbackAnalysis,
  strengthData?: { plateau: boolean },
  complexScore?: ComplexScore[],
): DeficitAttribution[] {
  const deficits: DeficitAttribution[] = [];

  // RECOVERY: readiness falling + soreness rising
  if (
    feedback.readinessTrend === "FALLING" &&
    feedback.sorenessTrend === "RISING"
  ) {
    deficits.push({
      type: "RECOVERY",
      confidence: 0.85,
      evidence: "Readiness trending down while soreness trending up",
      suggestedAction: "Implement deload week or reduce training frequency",
    });
  }

  // VOLUME: low adherence
  if (feedback.volumeAdherence < LOW_ADHERENCE_THRESHOLD) {
    deficits.push({
      type: "VOLUME",
      confidence: 0.80,
      evidence: `Volume adherence at ${Math.round(feedback.volumeAdherence * 100)}% (below ${LOW_ADHERENCE_THRESHOLD * 100}% threshold)`,
      suggestedAction: "Review prescribed volume — may be too high for current schedule",
    });
  }

  // TECHNICAL: high mark variance
  if (feedback.markVariance > HIGH_VARIANCE_THRESHOLD) {
    deficits.push({
      type: "TECHNICAL",
      confidence: 0.70,
      evidence: `Mark coefficient of variation at ${Math.round(feedback.markVariance * 100)}% (above ${HIGH_VARIANCE_THRESHOLD * 100}% threshold)`,
      suggestedAction: "Increase technical drill volume, focus on consistency",
    });
  }

  // STRENGTH: strength plateau
  if (strengthData?.plateau) {
    deficits.push({
      type: "STRENGTH",
      confidence: 0.75,
      evidence: "Strength metrics showing plateau",
      suggestedAction: "Rotate strength exercises or adjust loading parameters",
    });
  }

  // EXERCISE_SELECTION: low complex effectiveness
  if (complexScore && complexScore.length > 0) {
    const currentComplex = complexScore[0];
    if (currentComplex && currentComplex.effectiveness < 0.3) {
      deficits.push({
        type: "EXERCISE_SELECTION",
        confidence: 0.65,
        evidence: `Current complex effectiveness score: ${currentComplex.effectiveness.toFixed(2)}`,
        suggestedAction: "Consider rotating to a new exercise complex",
      });
    }
  }

  return deficits;
}

// ── Orchestrator ────────────────────────────────────────────────────

interface FeedbackLoopParams {
  marks: number[];
  prescribedThrows?: number;
  actualThrows?: number;
  rpeValues?: number[];
  readinessScores?: number[];
  sorenessScores?: number[];
  complexHistories?: ComplexHistory[];
  strengthPlateau?: boolean;
}

/**
 * Run the complete feedback loop analysis.
 */
export function runFeedbackLoop(params: FeedbackLoopParams): FeedbackLoopResult {
  // Fit logarithmic growth model
  const logFit = fitLogarithmicGrowth(params.marks);

  // Analyze feedback
  const feedback = analyzeFeedback({
    marks: params.marks,
    predictedMark: logFit.predictedMark,
    prescribedThrows: params.prescribedThrows,
    actualThrows: params.actualThrows,
    rpeValues: params.rpeValues,
    readinessScores: params.readinessScores,
    sorenessScores: params.sorenessScores,
  });

  // Score complex effectiveness
  const complexScore = params.complexHistories
    ? scoreComplexEffectiveness(params.complexHistories)
    : undefined;

  // Compute volume adjustment
  const volumeAdjustment = computeVolumeAdjustment(feedback);

  // Attribute deficits
  const deficits = attributeDeficit(
    feedback,
    params.strengthPlateau ? { plateau: true } : undefined,
    complexScore,
  );

  return {
    feedback,
    complexScore,
    volumeAdjustment,
    deficits,
  };
}

// ── Utility ─────────────────────────────────────────────────────────

/**
 * Generate a stable complex ID from exercise names.
 * Sorted, lowercased, pipe-delimited.
 */
export function generateComplexId(exerciseNames: string[]): string {
  return exerciseNames
    .map((n) => n.toLowerCase().trim())
    .sort()
    .join("|");
}

/**
 * Classify a trend direction from a series of values.
 */
function classifyTrend(values?: number[]): TrendDirection {
  if (!values || values.length < 3) return "STABLE";
  const slope = linearSlope(values);
  if (slope > SLOPE_THRESHOLD) return "RISING";
  if (slope < -SLOPE_THRESHOLD) return "FALLING";
  return "STABLE";
}
