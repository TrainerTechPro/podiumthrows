// ── Adaptation Checker ─────────────────────────────────────────────────
// Analyzes recent performance, readiness, and training load to recommend
// program adjustments per the Bondarchuk adaptation decision tree.

import { linearSlope } from "../profile-utils";
import { runFeedbackLoop } from "./feedback-loop";
import type {
  AdaptationCheckParams,
  AdaptationAssessment,
  AdaptationRecommendation,
  MarkTrend,
  StrengthTrend,
} from "./types";

// ── Configuration ─────────────────────────────────────────────────────

/** Minimum marks needed before making trend-based decisions */
const MIN_MARKS_FOR_TREND = 5;

/** Slope thresholds for mark trend classification */
const IMPROVING_SLOPE = 0.05; // positive slope above this = improving
const DECLINING_SLOPE = -0.05; // negative slope below this = declining

/** Readiness thresholds */
const LOW_READINESS_THRESHOLD = 55;
const ADEQUATE_READINESS_THRESHOLD = 65;

/** Soreness thresholds (scale 0-10) */
const HIGH_SORENESS_THRESHOLD = 6;

/** Consecutive low-readiness sessions triggering deload */
const CONSECUTIVE_LOW_READINESS_FOR_DELOAD = 3;

/** Form proximity — when sessionsInComplex nears sessionsToForm */
const FORM_APPROACH_WINDOW = 5; // sessions

// ── Main Function ─────────────────────────────────────────────────────

/**
 * Analyze recent training data and produce an adaptation recommendation.
 *
 * Decision tree (priority order):
 * 1. Already in form + readaptation risk → ROTATE_COMPLEX
 * 2. 3+ consecutive low readiness → DELOAD
 * 3. Declining marks + low readiness → REDUCE_VOLUME
 * 4. Declining marks + adequate readiness → ROTATE_COMPLEX
 * 5. Plateau + near sessionsToForm → approaching form (CONTINUE)
 * 6. Improving + nearing phase end → ADVANCE_PHASE
 * 7. Otherwise → CONTINUE
 */
export function checkAdaptation(
  params: AdaptationCheckParams,
): AdaptationAssessment {
  const {
    recentMarks,
    sessionsInComplex,
    sessionsToForm,
    enteredSportsForm,
    weeksSinceForm,
    recentReadinessScores,
    recentSorenessScores,
    strengthResults,
  } = params;

  // ── Calculate metrics ───────────────────────────────────────────────

  const markSlope = recentMarks.length >= 3 ? linearSlope(recentMarks) : 0;
  const averageMark =
    recentMarks.length > 0
      ? recentMarks.reduce((a, b) => a + b, 0) / recentMarks.length
      : 0;
  const peakMark = recentMarks.length > 0 ? Math.max(...recentMarks) : 0;

  const avgReadiness =
    recentReadinessScores.length > 0
      ? recentReadinessScores.reduce((a, b) => a + b, 0) /
        recentReadinessScores.length
      : 70;

  const avgSoreness =
    recentSorenessScores.length > 0
      ? recentSorenessScores.reduce((a, b) => a + b, 0) /
        recentSorenessScores.length
      : 3;

  // ── Classify trends ─────────────────────────────────────────────────

  let markTrend: MarkTrend = "PLATEAU";
  if (recentMarks.length >= MIN_MARKS_FOR_TREND) {
    if (markSlope > IMPROVING_SLOPE) markTrend = "IMPROVING";
    else if (markSlope < DECLINING_SLOPE) markTrend = "DECLINING";
  }

  let strengthTrend: StrengthTrend | undefined;
  if (strengthResults && strengthResults.length >= 4) {
    const weights = strengthResults.map((r) => r.weight);
    const sSlope = linearSlope(weights);
    if (sSlope > 0.5) strengthTrend = "IMPROVING";
    else if (sSlope < -0.5) strengthTrend = "DECLINING";
    else strengthTrend = "STABLE";
  }

  // Adaptation progress for context
  const sessionsProgress = sessionsToForm > 0
    ? sessionsInComplex / sessionsToForm
    : 0;
  let progressPhase: string;
  let progressLabel: string;
  if (enteredSportsForm) {
    progressPhase = weeksSinceForm < 3 ? "in-form" : "readaptation-risk";
    progressLabel = weeksSinceForm < 3 ? "IN FORM" : "Readaptation Risk";
  } else if (sessionsProgress < 0.2) {
    progressPhase = "loading";
    progressLabel = "Loading";
  } else if (sessionsProgress > 0.85) {
    progressPhase = "approaching";
    progressLabel = "Approaching Form";
  } else {
    progressPhase = "adapting";
    progressLabel = "Adapting";
  }

  const adaptationProgress = {
    progress: Math.round(Math.min(100, sessionsProgress * 100)),
    phase: progressPhase,
    label: progressLabel,
  };

  // ── Decision tree ───────────────────────────────────────────────────

  let recommendation: AdaptationRecommendation;
  let reasoning: string;

  // 1. In form + readaptation risk
  if (enteredSportsForm && weeksSinceForm >= 3) {
    recommendation = "ROTATE_COMPLEX";
    reasoning =
      `Athlete has been in sports form for ${weeksSinceForm} weeks. ` +
      `Readaptation risk is high — rotate exercise complex to start a new adaptation cycle.`;
  }

  // 2. Consecutive low readiness → deload
  else if (hasConsecutiveLowReadiness(recentReadinessScores)) {
    recommendation = "DELOAD";
    reasoning =
      `${CONSECUTIVE_LOW_READINESS_FOR_DELOAD}+ consecutive sessions with readiness below ${LOW_READINESS_THRESHOLD}. ` +
      `Recovery week recommended (50% volume reduction).`;
  }

  // 3. High soreness + declining marks
  else if (
    markTrend === "DECLINING" &&
    avgSoreness >= HIGH_SORENESS_THRESHOLD
  ) {
    recommendation = "REDUCE_VOLUME";
    reasoning =
      `Marks declining (slope: ${markSlope.toFixed(3)}) with high average soreness (${avgSoreness.toFixed(1)}/10). ` +
      `Reduce volume by 20% to manage fatigue accumulation.`;
  }

  // 4. Declining marks + low readiness → reduce volume
  else if (
    markTrend === "DECLINING" &&
    avgReadiness < ADEQUATE_READINESS_THRESHOLD
  ) {
    recommendation = "REDUCE_VOLUME";
    reasoning =
      `Marks declining (slope: ${markSlope.toFixed(3)}) with low readiness (avg: ${avgReadiness.toFixed(0)}). ` +
      `Volume reduction recommended before considering complex rotation.`;
  }

  // 5. Declining marks + adequate readiness → rotate
  else if (markTrend === "DECLINING" && avgReadiness >= ADEQUATE_READINESS_THRESHOLD) {
    recommendation = "ROTATE_COMPLEX";
    reasoning =
      `Marks declining despite adequate readiness (${avgReadiness.toFixed(0)}). ` +
      `Exercise complex may have lost effectiveness — rotate to fresh stimulus.`;
  }

  // 6. Approaching form (plateau near sessionsToForm)
  else if (
    markTrend === "PLATEAU" &&
    sessionsInComplex >= sessionsToForm - FORM_APPROACH_WINDOW &&
    !enteredSportsForm
  ) {
    recommendation = "CONTINUE";
    reasoning =
      `Marks stabilizing near expected form window (${sessionsInComplex}/${sessionsToForm} sessions). ` +
      `Continue current complex — sports form may be imminent.`;
  }

  // 7. Improving marks
  else if (markTrend === "IMPROVING") {
    recommendation = "CONTINUE";
    reasoning =
      `Marks improving (slope: ${markSlope.toFixed(3)}, peak: ${peakMark.toFixed(2)}m). ` +
      `Continue current training — adaptation is progressing well.`;
  }

  // 8. Default: continue
  else {
    recommendation = "CONTINUE";
    reasoning =
      `No concerning trends detected. Average mark: ${averageMark.toFixed(2)}m, ` +
      `readiness: ${avgReadiness.toFixed(0)}, sessions in complex: ${sessionsInComplex}/${sessionsToForm}.`;
  }

  const baseAssessment: AdaptationAssessment = {
    recommendation,
    reasoning,
    markTrend,
    markSlope,
    averageMark,
    peakMark,
    avgReadiness,
    avgSoreness,
    strengthTrend,
    adaptationProgress,
  };

  // ── Gap 5: Feedback loop enrichment ─────────────────────────────────
  // Only runs if sufficient historical marks are provided
  if (params.historicalMarks && params.historicalMarks.length >= 5) {
    const feedbackResult = runFeedbackLoop({
      marks: params.historicalMarks,
      prescribedThrows: params.prescribedThrowsTotal,
      actualThrows: params.actualThrowsTotal,
      rpeValues: params.rpeValues,
      readinessScores: recentReadinessScores,
      sorenessScores: recentSorenessScores,
      complexHistories: params.complexHistory,
      strengthPlateau: strengthTrend === "DECLINING" || strengthTrend === "STABLE",
    });

    // Enrich assessment with feedback data
    baseAssessment.predictedMark = feedbackResult.feedback.predictedMark;
    baseAssessment.actualVsPredicted = feedbackResult.feedback.deviation;
    baseAssessment.deficitAttribution = feedbackResult.deficits;
    baseAssessment.volumeAdjustment = feedbackResult.volumeAdjustment;
    baseAssessment.feedbackConfidence = feedbackResult.feedback.markVariance < 0.08 ? 0.8 : 0.5;

    if (feedbackResult.complexScore && feedbackResult.complexScore.length > 0) {
      baseAssessment.complexEffectiveness = feedbackResult.complexScore[0].effectiveness;
    }

    // Safety overrides: feedback can push toward DELOAD or REDUCE_VOLUME
    // but never toward more volume (conservative safety net)
    if (
      feedbackResult.volumeAdjustment.category === "OVERTRAINING" ||
      feedbackResult.volumeAdjustment.category === "DELOAD"
    ) {
      if (
        baseAssessment.recommendation !== "DELOAD" &&
        baseAssessment.recommendation !== "REDUCE_VOLUME"
      ) {
        baseAssessment.recommendation =
          feedbackResult.volumeAdjustment.category === "DELOAD"
            ? "DELOAD"
            : "REDUCE_VOLUME";
        baseAssessment.reasoning +=
          ` [Feedback override: ${feedbackResult.volumeAdjustment.reason}]`;
      }
    }
  }

  return baseAssessment;
}

// ── Helpers ───────────────────────────────────────────────────────────

function hasConsecutiveLowReadiness(scores: number[]): boolean {
  if (scores.length < CONSECUTIVE_LOW_READINESS_FOR_DELOAD) return false;

  const recent = scores.slice(-CONSECUTIVE_LOW_READINESS_FOR_DELOAD);
  return recent.every((s) => s < LOW_READINESS_THRESHOLD);
}
