import type {
  ClipConfidence,
  ConfidenceGrade,
  MetricValue,
} from "@/lib/contracts";

/**
 * Graded confidence for quick-analysis mode (uncalibrated / imperfectly
 * filmed footage). Replaces the binary low-confidence flag with HIGH /
 * MEDIUM / LOW at two levels:
 *
 *  - per clip: pose quality (F4 temporal layer) × true fps × the share of
 *    frames that needed interpolation or fell below trust;
 *  - per metric: the measured numeric confidence, capped by the clip grade,
 *    and — without calibration — capped at MEDIUM for view-sensitive
 *    metrics: camera angle shifts apparent sagittal-plane angles, so those
 *    readings are starting points to verify, never certainties. Timing and
 *    phase metrics are view-robust and keep their measured confidence.
 *
 * Pure functions, no IO.
 */

/** A metric whose value changes materially with camera angle. */
export type ViewSensitivity = "HIGH" | "LOW";

// Clip-grade thresholds. Mean pose quality below QUALITY_MEDIUM is already
// near the temporal layer's refilm gate (0.5) — anything in between is LOW.
export const QUALITY_HIGH = 0.8;
export const QUALITY_MEDIUM = 0.65;
export const FPS_HIGH = 60;
export const FPS_MEDIUM = 30;
/** A frame below this pose quality counts as degraded (interpolated keypoints
 * land here too: interpolation writes conf at 0.8 × the gap endpoints). */
export const DEGRADED_FRAME_QUALITY = 0.6;
export const DEGRADED_FRACTION_HIGH = 0.1;
export const DEGRADED_FRACTION_MEDIUM = 0.35;

// Per-metric numeric-confidence cutoffs. MEDIUM starts at the rules engine's
// default minConfidence (0.5): a metric the fault engine trusts is at least
// MEDIUM.
export const METRIC_CONFIDENCE_HIGH = 0.8;
export const METRIC_CONFIDENCE_MEDIUM = 0.5;

const GRADE_ORDER: Record<ConfidenceGrade, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export function minGrade(...grades: ConfidenceGrade[]): ConfidenceGrade {
  return grades.reduce((a, b) => (GRADE_ORDER[b] < GRADE_ORDER[a] ? b : a), "HIGH");
}

function gradeQuality(meanQuality: number): ConfidenceGrade {
  if (meanQuality >= QUALITY_HIGH) return "HIGH";
  if (meanQuality >= QUALITY_MEDIUM) return "MEDIUM";
  return "LOW";
}

function gradeFps(fps: number): ConfidenceGrade {
  if (fps >= FPS_HIGH) return "HIGH";
  if (fps >= FPS_MEDIUM) return "MEDIUM";
  return "LOW";
}

function gradeDegradedFraction(fraction: number): ConfidenceGrade {
  if (fraction <= DEGRADED_FRACTION_HIGH) return "HIGH";
  if (fraction <= DEGRADED_FRACTION_MEDIUM) return "MEDIUM";
  return "LOW";
}

/** Clip grade = the worst of its three signals — one bad axis taints the clip. */
export function gradeClipConfidence(input: {
  meanQuality: number;
  fps: number;
  perFrameQuality: number[];
}): ClipConfidence {
  const degraded = input.perFrameQuality.filter((q) => q < DEGRADED_FRAME_QUALITY).length;
  const degradedFrameFraction =
    input.perFrameQuality.length > 0
      ? round3(degraded / input.perFrameQuality.length)
      : 1;
  return {
    grade: minGrade(
      gradeQuality(input.meanQuality),
      gradeFps(input.fps),
      gradeDegradedFraction(degradedFrameFraction)
    ),
    meanQuality: input.meanQuality,
    fps: input.fps,
    degradedFrameFraction,
  };
}

export function gradeMetricConfidence(confidence: number): ConfidenceGrade {
  if (confidence >= METRIC_CONFIDENCE_HIGH) return "HIGH";
  if (confidence >= METRIC_CONFIDENCE_MEDIUM) return "MEDIUM";
  return "LOW";
}

/**
 * Decorates each measured metric with its grade:
 * min(numeric grade, clip grade), then the uncalibrated view-sensitivity cap.
 * Null-valued metrics stay ungraded — "requires calibrated session" / "not
 * measurable" is a product state, not a confidence level.
 */
export function applyConfidenceGrades(
  metrics: Record<string, MetricValue>,
  opts: {
    clipGrade: ConfidenceGrade;
    calibrated: boolean;
    viewSensitivity: Record<string, ViewSensitivity>;
  }
): Record<string, MetricValue> {
  const out: Record<string, MetricValue> = {};
  for (const [key, metric] of Object.entries(metrics)) {
    if (metric.value === null) {
      out[key] = metric;
      continue;
    }
    let grade = minGrade(gradeMetricConfidence(metric.confidence), opts.clipGrade);
    if (!opts.calibrated && opts.viewSensitivity[key] === "HIGH") {
      grade = minGrade(grade, "MEDIUM");
    }
    out[key] = { ...metric, confidenceGrade: grade };
  }
  return out;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
