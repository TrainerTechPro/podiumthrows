import { describe, it, expect } from "vitest";
import {
  computePck,
  computeSwapRate,
  computeReleaseErrors,
  computePhaseIou,
  runBenchmark,
} from "../benchmark";
import { COCO17_KEYPOINTS, type PoseOutput, type Keypoint } from "@/lib/contracts";
import type { GoldenLabels } from "../labels";

/**
 * Fabricated pose data with hand-computed expected numbers. These values are
 * the Stage-2 VERIFY gate: if any change, the harness definition changed and
 * every existing benchmark row is invalid.
 */

function makeKeypoints(at: Partial<Record<string, [number, number]>>): Keypoint[] {
  return COCO17_KEYPOINTS.map((name) => {
    const pos = at[name] ?? [0, 0];
    return { x: pos[0], y: pos[1], conf: 0.99 };
  });
}

function makePose(frames: PoseOutput["frames"]): PoseOutput {
  return {
    schemaVersion: "1.0",
    jobId: "fixture",
    modelId: "fabricated",
    modelVersion: "0",
    fps: 60,
    resolution: { width: 1920, height: 1080 },
    frames,
  };
}

function makeLabels(overrides: Partial<GoldenLabels>): GoldenLabels {
  return {
    schemaVersion: "1.0",
    event: "SHOT_PUT",
    fps: 60,
    totalFrames: 100,
    releaseFrame: null,
    phaseBoundaries: [],
    keypointGT: [],
    notes: null,
    ...overrides,
  };
}

describe("computePck — PCK@0.05, norm = max GT bbox side", () => {
  // GT box: shoulders at y=0, hips at y=100, x ∈ {0,100} → norm 100, thresh 5.
  const labels = makeLabels({
    keypointGT: [
      {
        frame: 0,
        keypoints: {
          left_shoulder: { x: 0, y: 0, visible: true },
          right_shoulder: { x: 100, y: 0, visible: true },
          left_hip: { x: 0, y: 100, visible: true },
          right_hip: { x: 100, y: 100, visible: true },
        },
      },
    ],
  });

  it("scores upper 2/2 = 1.0 and lower 1/2 = 0.5 exactly", () => {
    const pose = makePose([
      {
        idx: 0,
        t: 0,
        bbox: [0, 0, 100, 100],
        keypoints: makeKeypoints({
          left_shoulder: [0, 0], // exact → correct
          right_shoulder: [103, 0], // off 3 ≤ 5 → correct
          left_hip: [0, 104], // off 4 ≤ 5 → correct
          right_hip: [100, 106], // off 6 > 5 → incorrect
        }),
      },
    ]);
    const r = computePck(pose, labels);
    expect(r.upper).toEqual({ correct: 2, total: 2, pck: 1.0 });
    expect(r.lower).toEqual({ correct: 1, total: 2, pck: 0.5 });
    expect(r.framesEvaluated).toBe(1);
    expect(r.framesSkipped).toBe(0);
  });

  it("counts missing detections as incorrect (PCK 0)", () => {
    const pose = makePose([{ idx: 0, t: 0, bbox: null, keypoints: null }]);
    const r = computePck(pose, labels);
    expect(r.upper.pck).toBe(0);
    expect(r.lower.pck).toBe(0);
  });

  it("skips frames with fewer than 2 visible GT keypoints", () => {
    const sparse = makeLabels({
      keypointGT: [
        { frame: 0, keypoints: { nose: { x: 1, y: 1, visible: true } } },
      ],
    });
    const r = computePck(makePose([]), sparse);
    expect(r.framesEvaluated).toBe(0);
    expect(r.framesSkipped).toBe(1);
    expect(r.upper.pck).toBeNull();
  });
});

describe("computeSwapRate — crossed assignment detection", () => {
  const gt = makeLabels({
    keypointGT: [
      {
        frame: 0,
        keypoints: {
          left_wrist: { x: 0, y: 50, visible: true },
          right_wrist: { x: 100, y: 50, visible: true },
        },
      },
      {
        frame: 1,
        keypoints: {
          left_wrist: { x: 0, y: 50, visible: true },
          right_wrist: { x: 100, y: 50, visible: true },
        },
      },
    ],
  });

  it("detects an exactly swapped pair in 1 of 2 frames → rate 0.5", () => {
    const pose = makePose([
      {
        idx: 0,
        t: 0,
        bbox: [0, 0, 100, 100],
        // swapped: predicted left at GT right and vice versa
        keypoints: makeKeypoints({ left_wrist: [100, 50], right_wrist: [0, 50] }),
      },
      {
        idx: 1,
        t: 1 / 60,
        bbox: [0, 0, 100, 100],
        keypoints: makeKeypoints({ left_wrist: [2, 50], right_wrist: [98, 50] }),
      },
    ]);
    const r = computeSwapRate(pose, gt);
    expect(r).toEqual({ framesEvaluated: 2, framesSwapped: 1, swapRate: 0.5 });
  });
});

describe("computeReleaseErrors — error distribution", () => {
  it("computes exact meanAbs, median, within-tolerance", () => {
    const r = computeReleaseErrors([
      { predicted: 50, gt: 50, fps: 60 }, // err 0, within (tol 2)
      { predicted: 61, gt: 60, fps: 60 }, // err +1, within
      { predicted: 37, gt: 40, fps: 60 }, // err −3, outside
    ]);
    expect(r.errors).toEqual([0, 1, -3]);
    expect(r.meanAbs).toBeCloseTo(4 / 3, 10);
    expect(r.median).toBe(0);
    expect(r.withinTolerance).toBeCloseTo(2 / 3, 10);
  });

  it("scales tolerance with fps (±2 @60fps ⇒ ±8 @240fps)", () => {
    const r = computeReleaseErrors([
      { predicted: 107, gt: 100, fps: 240 }, // err 7 ≤ 8 → within
      { predicted: 109, gt: 100, fps: 240 }, // err 9 > 8 → outside
    ]);
    expect(r.withinTolerance).toBe(0.5);
  });

  it("counts a missed prediction against tolerance but not the distribution", () => {
    const r = computeReleaseErrors([
      { predicted: null, gt: 30, fps: 60 },
      { predicted: 30, gt: 30, fps: 60 },
    ]);
    expect(r.errors).toEqual([0]);
    expect(r.withinTolerance).toBe(0.5);
  });
});

describe("computePhaseIou — inclusive frame ranges", () => {
  it("computes exact IoU and penalizes missing predicted phases", () => {
    const r = computePhaseIou(
      [
        { phase: "entry", startFrame: 0, endFrame: 9 },
        { phase: "drive", startFrame: 10, endFrame: 19 },
      ],
      [
        { phase: "entry", startFrame: 5, endFrame: 14 }, // overlap 5, union 15 → 1/3
        { phase: "drive", startFrame: 10, endFrame: 19 }, // exact → 1
        { phase: "delivery", startFrame: 20, endFrame: 29 }, // missing → 0
      ]
    );
    expect(r.perPhase.entry).toBeCloseTo(1 / 3, 10);
    expect(r.perPhase.drive).toBe(1);
    expect(r.perPhase.delivery).toBe(0);
    expect(r.mean).toBeCloseTo((1 / 3 + 1 + 0) / 3, 10);
  });
});

describe("runBenchmark — end-to-end on a synthetic fixture", () => {
  it("aggregates to exact expected numbers", () => {
    const labels = makeLabels({
      releaseFrame: 60,
      phaseBoundaries: [{ phase: "delivery", startFrame: 50, endFrame: 65 }],
      keypointGT: [
        {
          frame: 10,
          keypoints: {
            left_shoulder: { x: 0, y: 0, visible: true },
            right_shoulder: { x: 100, y: 0, visible: true },
            left_hip: { x: 0, y: 100, visible: true },
            right_hip: { x: 100, y: 100, visible: true },
          },
        },
      ],
    });
    const pose = makePose([
      {
        idx: 10,
        t: 10 / 60,
        bbox: [0, 0, 100, 100],
        keypoints: makeKeypoints({
          left_shoulder: [0, 0],
          right_shoulder: [100, 0],
          left_hip: [0, 100],
          right_hip: [100, 110], // off 10 > 5 → incorrect
        }),
      },
    ]);
    const report = runBenchmark([
      {
        clipId: "fixture-1",
        pose,
        labels,
        prediction: {
          releaseFrame: 61,
          phaseBoundaries: [{ phase: "delivery", startFrame: 50, endFrame: 65 }],
        },
      },
    ]);
    expect(report.aggregate.pckUpper).toBe(1);
    expect(report.aggregate.pckLower).toBe(0.5);
    expect(report.aggregate.swapRate).toBe(0);
    expect(report.aggregate.release.withinTolerance).toBe(1);
    expect(report.clips[0].releaseError).toBe(1);
    expect(report.aggregate.phaseIouMean).toBe(1);
  });
});
