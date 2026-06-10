import {
  COCO17_KEYPOINTS,
  type PoseOutput,
  type SmoothedPose,
} from "@/lib/contracts";
import { tracksFromPose, type Tracks } from "./tracks";
import { gateByConfidence, DEFAULT_CONF_THRESHOLD } from "./confidence-gate";
import { enforceLeftRight } from "./lr-enforce";
import { interpolateGaps, DEFAULT_MAX_GAP_FRAMES } from "./interpolate";
import { smoothOneEuro, DEFAULT_ONE_EURO, type OneEuroParams } from "./one-euro";
import { computeQuality, LOW_CONFIDENCE_THRESHOLD } from "./quality";

/**
 * F4 — the temporal pipeline, in the PRD's fixed order:
 * confidence gate → L/R enforcement → gap interpolation → OneEuro smoothing.
 * Pure and deterministic: same PoseOutput in, bit-identical SmoothedPose out.
 */

export const TEMPORAL_VERSION = "temporal-1.0.0";

export interface TemporalOptions {
  confThreshold?: number;
  maxGapFrames?: number;
  oneEuro?: OneEuroParams;
  lowConfidenceThreshold?: number;
}

export interface TemporalResult {
  smoothed: SmoothedPose;
  swappedFrames: number[];
}

function tracksToFrames(
  tracks: Tracks,
  original: PoseOutput
): SmoothedPose["frames"] {
  return original.frames.map((frame, fi) => {
    const kps = COCO17_KEYPOINTS.map((_, ki) => tracks.points[ki][fi]);
    const present = kps.filter((p): p is NonNullable<typeof p> => p !== null);
    if (present.length === 0) {
      return { idx: frame.idx, t: frame.t, bbox: null, keypoints: null };
    }
    const xs = present.map((p) => p.x);
    const ys = present.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      idx: frame.idx,
      t: frame.t,
      bbox: [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY] as [
        number,
        number,
        number,
        number,
      ],
      // The contract fixes keypoints at exactly 17 slots. A landmark the
      // temporal layer refused to trust is emitted as conf 0 — every consumer
      // (metrics, overlays) treats conf 0 as absent, never as a position.
      keypoints: kps.map((p) => (p ? p : { x: 0, y: 0, conf: 0 })),
    };
  });
}

export function runTemporalPipeline(
  pose: PoseOutput,
  options: TemporalOptions = {}
): TemporalResult {
  const gated = gateByConfidence(
    tracksFromPose(pose),
    options.confThreshold ?? DEFAULT_CONF_THRESHOLD
  );
  const { tracks: lrFixed, swappedFrames } = enforceLeftRight(gated);
  const filled = interpolateGaps(lrFixed, options.maxGapFrames ?? DEFAULT_MAX_GAP_FRAMES);
  const smoothedTracks = smoothOneEuro(filled, options.oneEuro ?? DEFAULT_ONE_EURO);
  const quality = computeQuality(
    smoothedTracks,
    options.lowConfidenceThreshold ?? LOW_CONFIDENCE_THRESHOLD
  );

  const smoothed: SmoothedPose = {
    schemaVersion: pose.schemaVersion,
    jobId: pose.jobId,
    modelId: pose.modelId,
    modelVersion: pose.modelVersion,
    fps: pose.fps,
    resolution: pose.resolution,
    frames: tracksToFrames(smoothedTracks, pose),
    temporalVersion: TEMPORAL_VERSION,
    perFrameQuality: quality.perFrame,
    meanQuality: quality.mean,
  };

  return { smoothed, swappedFrames };
}

export { LOW_CONFIDENCE_THRESHOLD };
