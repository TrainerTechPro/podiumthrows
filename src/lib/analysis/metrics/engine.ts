import {
  METRICS_SCHEMA_VERSION,
  MetricsOutputSchema,
  type AnalysisEvent,
  type Homography,
  type MetricsOutput,
  type SmoothedPose,
} from "@/lib/contracts";
import { LOW_CONFIDENCE_THRESHOLD } from "../temporal/quality";
import { applyConfidenceGrades, gradeClipConfidence } from "../confidence";
import {
  computeShotPutMetrics,
  SHOTPUT_DEFINITIONS_VERSION,
  SHOTPUT_VIEW_SENSITIVITY,
} from "./definitions/shotput";
import type { Hand } from "./release";

/**
 * Event-agnostic metrics engine (F5): dispatches to per-event definitions,
 * stamps versions, validates its own output against the contract before
 * returning — a metrics bug fails loudly here, not in the UI.
 *
 * Hammer definitions are the PRD Phase-5 fast-follow; the dispatch table is
 * the extension point.
 */

export function runMetricsEngine(args: {
  pose: SmoothedPose;
  event: AnalysisEvent;
  homography: Homography | null;
  hand?: Hand;
}): MetricsOutput {
  const { pose, event, homography, hand } = args;

  if (event !== "SHOT_PUT") {
    throw new Error(`No metric definitions for event ${event} (v1 ships shot put)`);
  }

  const { metrics, phaseBoundaries } = computeShotPutMetrics(pose, {
    homography,
    hand,
  });

  const calibrated = homography !== null;
  const clipConfidence = gradeClipConfidence({
    meanQuality: pose.meanQuality,
    fps: pose.fps,
    perFrameQuality: pose.perFrameQuality,
  });

  const output: MetricsOutput = {
    schemaVersion: METRICS_SCHEMA_VERSION,
    event,
    definitionsVersion: SHOTPUT_DEFINITIONS_VERSION,
    calibrated,
    metrics: applyConfidenceGrades(metrics, {
      clipGrade: clipConfidence.grade,
      calibrated,
      viewSensitivity: SHOTPUT_VIEW_SENSITIVITY,
    }),
    phaseBoundaries,
    quality: {
      meanQuality: pose.meanQuality,
      lowConfidence: pose.meanQuality < LOW_CONFIDENCE_THRESHOLD,
    },
    clipConfidence,
  };

  return MetricsOutputSchema.parse(output);
}
