import {
  COCO17_KEYPOINTS,
  type Coco17KeypointName,
  type PoseOutput,
  type PhaseBoundary,
} from "@/lib/contracts";
import type { GoldenLabels } from "./labels";

/**
 * Deterministic eval harness (PRD §9 Phase 0, §11). No LLM judging anywhere.
 *
 * Definitions (fixed; changing any of these invalidates prior benchmark rows):
 * - PCK@0.05: a predicted keypoint is correct iff its euclidean distance to GT
 *   is ≤ 0.05 × normFactor, where normFactor = max(width, height) of the
 *   bounding box of the *visible GT keypoints* in that frame. Frames with
 *   < 2 visible GT points or a degenerate (zero-size) box are skipped.
 *   Missing prediction (no detection) counts as incorrect.
 * - Upper body: nose…wrists (COCO indices 0–10). Lower: hips…ankles (11–16).
 * - Left/right swap: for each L/R joint pair with both sides visible in GT and
 *   predicted, the pair is swapped iff d(predL,gtR)+d(predR,gtL) <
 *   d(predL,gtL)+d(predR,gtR). A frame counts as swapped iff ≥ 1 pair swaps.
 * - Release-frame error: predicted − GT (frames). "Within ±2 @60fps" scales
 *   the tolerance to the clip: tol = round(2 × fps / 60).
 * - Phase-boundary IoU on inclusive frame ranges, matched by phase name;
 *   phases present in GT but missing from the prediction score 0.
 */

const UPPER_BODY = new Set<Coco17KeypointName>([
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
]);

const LR_PAIRS: Array<[Coco17KeypointName, Coco17KeypointName]> = [
  ["left_eye", "right_eye"],
  ["left_ear", "right_ear"],
  ["left_shoulder", "right_shoulder"],
  ["left_elbow", "right_elbow"],
  ["left_wrist", "right_wrist"],
  ["left_hip", "right_hip"],
  ["left_knee", "right_knee"],
  ["left_ankle", "right_ankle"],
];

const KP_INDEX = new Map<Coco17KeypointName, number>(
  COCO17_KEYPOINTS.map((name, i) => [name, i])
);

const PCK_ALPHA = 0.05;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export interface PckResult {
  upper: { correct: number; total: number; pck: number | null };
  lower: { correct: number; total: number; pck: number | null };
  framesEvaluated: number;
  framesSkipped: number;
}

export function computePck(pose: PoseOutput, labels: GoldenLabels): PckResult {
  let upCorrect = 0;
  let upTotal = 0;
  let loCorrect = 0;
  let loTotal = 0;
  let evaluated = 0;
  let skipped = 0;

  for (const gtFrame of labels.keypointGT) {
    const visible = Object.entries(gtFrame.keypoints).flatMap(([name, kp]) =>
      kp && kp.visible ? ([[name, kp]] as Array<[string, { x: number; y: number }]>) : []
    );
    if (visible.length < 2) {
      skipped++;
      continue;
    }
    const xs = visible.map(([, kp]) => kp.x);
    const ys = visible.map(([, kp]) => kp.y);
    const norm = Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys)
    );
    if (norm <= 0) {
      skipped++;
      continue;
    }
    const threshold = PCK_ALPHA * norm;
    const predFrame = pose.frames.find((f) => f.idx === gtFrame.frame);
    evaluated++;

    for (const [name, gt] of visible) {
      const isUpper = UPPER_BODY.has(name as Coco17KeypointName);
      if (isUpper) upTotal++;
      else loTotal++;

      const predKps = predFrame?.keypoints ?? null;
      if (!predKps) continue; // missing prediction = incorrect
      const idx = KP_INDEX.get(name as Coco17KeypointName);
      if (idx === undefined) continue;
      const pred = predKps[idx];
      if (dist(pred.x, pred.y, gt.x, gt.y) <= threshold) {
        if (isUpper) upCorrect++;
        else loCorrect++;
      }
    }
  }

  return {
    upper: {
      correct: upCorrect,
      total: upTotal,
      pck: upTotal > 0 ? upCorrect / upTotal : null,
    },
    lower: {
      correct: loCorrect,
      total: loTotal,
      pck: loTotal > 0 ? loCorrect / loTotal : null,
    },
    framesEvaluated: evaluated,
    framesSkipped: skipped,
  };
}

export interface SwapResult {
  framesEvaluated: number;
  framesSwapped: number;
  swapRate: number | null;
}

export function computeSwapRate(
  pose: PoseOutput,
  labels: GoldenLabels
): SwapResult {
  let evaluated = 0;
  let swapped = 0;

  for (const gtFrame of labels.keypointGT) {
    const predFrame = pose.frames.find((f) => f.idx === gtFrame.frame);
    const predKps = predFrame?.keypoints ?? null;
    if (!predKps) continue;

    let anyPairEvaluated = false;
    let frameSwapped = false;
    for (const [left, right] of LR_PAIRS) {
      const gtL = gtFrame.keypoints[left];
      const gtR = gtFrame.keypoints[right];
      if (!gtL?.visible || !gtR?.visible) continue;
      const pL = predKps[KP_INDEX.get(left)!];
      const pR = predKps[KP_INDEX.get(right)!];
      anyPairEvaluated = true;
      const straight =
        dist(pL.x, pL.y, gtL.x, gtL.y) + dist(pR.x, pR.y, gtR.x, gtR.y);
      const crossed =
        dist(pL.x, pL.y, gtR.x, gtR.y) + dist(pR.x, pR.y, gtL.x, gtL.y);
      if (crossed < straight) frameSwapped = true;
    }
    if (anyPairEvaluated) {
      evaluated++;
      if (frameSwapped) swapped++;
    }
  }

  return {
    framesEvaluated: evaluated,
    framesSwapped: swapped,
    swapRate: evaluated > 0 ? swapped / evaluated : null,
  };
}

export interface ReleaseErrorResult {
  errors: number[]; // predicted − GT, one per clip with both present
  meanAbs: number | null;
  median: number | null;
  p95Abs: number | null;
  withinTolerance: number | null; // fraction within ±2 frames @60fps-equivalent
}

export function computeReleaseErrors(
  entries: Array<{ predicted: number | null; gt: number | null; fps: number }>
): ReleaseErrorResult {
  const errors: number[] = [];
  let withinCount = 0;
  let withinTotal = 0;

  for (const { predicted, gt, fps } of entries) {
    if (gt === null) continue;
    withinTotal++;
    if (predicted === null) continue; // missed detection: outside tolerance
    const err = predicted - gt;
    errors.push(err);
    const tol = Math.round((2 * fps) / 60);
    if (Math.abs(err) <= tol) withinCount++;
  }

  if (withinTotal === 0) {
    return { errors, meanAbs: null, median: null, p95Abs: null, withinTolerance: null };
  }

  const abs = errors.map(Math.abs).sort((a, b) => a - b);
  const sorted = [...errors].sort((a, b) => a - b);
  const median =
    sorted.length === 0
      ? null
      : sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

  return {
    errors,
    meanAbs: abs.length ? abs.reduce((a, b) => a + b, 0) / abs.length : null,
    median,
    p95Abs: abs.length ? abs[Math.min(abs.length - 1, Math.ceil(0.95 * abs.length) - 1)] : null,
    withinTolerance: withinCount / withinTotal,
  };
}

export interface PhaseIouResult {
  perPhase: Record<string, number>;
  mean: number | null;
}

export function computePhaseIou(
  predicted: PhaseBoundary[],
  gt: GoldenLabels["phaseBoundaries"]
): PhaseIouResult {
  const perPhase: Record<string, number> = {};
  for (const g of gt) {
    const p = predicted.find((x) => x.phase === g.phase);
    if (!p) {
      perPhase[g.phase] = 0;
      continue;
    }
    const overlap = Math.max(
      0,
      Math.min(p.endFrame, g.endFrame) - Math.max(p.startFrame, g.startFrame) + 1
    );
    const union =
      p.endFrame -
      p.startFrame +
      1 +
      (g.endFrame - g.startFrame + 1) -
      overlap;
    perPhase[g.phase] = union > 0 ? overlap / union : 0;
  }
  const values = Object.values(perPhase);
  return {
    perPhase,
    mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
  };
}

// ── Clip + aggregate runners ────────────────────────────────────────────────

export interface ClipPrediction {
  /** From MetricsOutput.metrics.release_frame.value (Stage 4 pipeline). */
  releaseFrame: number | null;
  phaseBoundaries: PhaseBoundary[];
}

export interface ClipBenchmark {
  clipId: string;
  pck: PckResult;
  swap: SwapResult;
  releaseError: number | null;
  phaseIou: PhaseIouResult | null;
}

export interface BenchmarkReport {
  modelId: string;
  clips: ClipBenchmark[];
  aggregate: {
    pckUpper: number | null;
    pckLower: number | null;
    swapRate: number | null;
    release: ReleaseErrorResult;
    phaseIouMean: number | null;
  };
}

export function runBenchmark(
  inputs: Array<{
    clipId: string;
    pose: PoseOutput;
    labels: GoldenLabels;
    prediction?: ClipPrediction | null;
  }>
): BenchmarkReport {
  const clips: ClipBenchmark[] = [];
  let upC = 0,
    upT = 0,
    loC = 0,
    loT = 0,
    swF = 0,
    swE = 0;
  const releaseEntries: Array<{
    predicted: number | null;
    gt: number | null;
    fps: number;
  }> = [];
  const iouMeans: number[] = [];

  for (const { clipId, pose, labels, prediction } of inputs) {
    const pck = computePck(pose, labels);
    const swap = computeSwapRate(pose, labels);
    upC += pck.upper.correct;
    upT += pck.upper.total;
    loC += pck.lower.correct;
    loT += pck.lower.total;
    swF += swap.framesSwapped;
    swE += swap.framesEvaluated;

    let releaseError: number | null = null;
    let phaseIou: PhaseIouResult | null = null;
    if (prediction) {
      releaseEntries.push({
        predicted: prediction.releaseFrame,
        gt: labels.releaseFrame,
        fps: labels.fps,
      });
      if (
        prediction.releaseFrame !== null &&
        labels.releaseFrame !== null
      ) {
        releaseError = prediction.releaseFrame - labels.releaseFrame;
      }
      if (labels.phaseBoundaries.length > 0) {
        phaseIou = computePhaseIou(
          prediction.phaseBoundaries,
          labels.phaseBoundaries
        );
        if (phaseIou.mean !== null) iouMeans.push(phaseIou.mean);
      }
    }

    clips.push({ clipId, pck, swap, releaseError, phaseIou });
  }

  return {
    modelId: inputs[0]?.pose.modelId ?? "unknown",
    clips,
    aggregate: {
      pckUpper: upT > 0 ? upC / upT : null,
      pckLower: loT > 0 ? loC / loT : null,
      swapRate: swE > 0 ? swF / swE : null,
      release: computeReleaseErrors(releaseEntries),
      phaseIouMean: iouMeans.length
        ? iouMeans.reduce((a, b) => a + b, 0) / iouMeans.length
        : null,
    },
  };
}
