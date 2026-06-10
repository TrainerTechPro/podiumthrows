import { describe, it, expect } from "vitest";
import {
  COCO17_KEYPOINTS,
  MetricsOutputSchema,
  type Homography,
  type Keypoint,
  type SmoothedPose,
} from "@/lib/contracts";
import { runMetricsEngine } from "../engine";
import { detectRelease } from "../release";
import { segmentShotPutPhases } from "../phases";
import { runBenchmark } from "../../eval/benchmark";

/**
 * Synthetic shot put throw with hand-constructed geometry:
 *  - 120 frames @60fps, all keypoints conf 0.9
 *  - body translates +8 px/frame in x from frame 21
 *  - hip–shoulder separation ramps 0→50° peaking at frame 45, decays to 10°
 *  - right-wrist speed spikes with central-difference max exactly at frame 60
 *  - right elbow always on the shoulder–wrist segment (extension ≈ 180°)
 *  - block (left) leg nearly straight at release
 *  - right ankle sweeps to 0.5 leg-lengths during frames 25–35
 * Every expected number below is computed by hand from this construction.
 */

const FPS = 60;
const FRAMES = 120;
const PPM = 300; // pixelsPerMeter for the calibrated run

function wristX(f: number): number {
  if (f <= 58) return 500;
  if (f === 59) return 520;
  if (f === 60) return 560;
  if (f === 61) return 620;
  return 650;
}

function shoulderTheta(f: number): number {
  if (f < 20) return 0;
  if (f <= 45) return ((f - 20) / 25) * 50; // ramp to 50° at 45
  if (f <= 57) return 50 - ((f - 45) / 12) * 40; // decay to 10°
  return 10;
}

function bodyX(f: number): number {
  return 500 + 8 * Math.max(0, f - 20);
}

function buildFrame(f: number): SmoothedPose["frames"][number] {
  const xc = bodyX(f);
  const theta = (shoulderTheta(f) * Math.PI) / 180;
  const midShoulder = { x: xc, y: 300 };
  const ls = {
    x: midShoulder.x - 100 * Math.cos(theta),
    y: midShoulder.y - 100 * Math.sin(theta),
  };
  const rs = {
    x: midShoulder.x + 100 * Math.cos(theta),
    y: midShoulder.y + 100 * Math.sin(theta),
  };
  const rw = { x: wristX(f), y: 400 };
  const lw = { x: xc - 150, y: 450 };
  const re = { x: (rs.x + rw.x) / 2, y: (rs.y + rw.y) / 2 };
  const le = { x: (ls.x + lw.x) / 2, y: (ls.y + lw.y) / 2 };
  const rightAnkleY = f >= 25 && f <= 35 ? 700 : 900;

  const pos: Record<string, { x: number; y: number }> = {
    nose: { x: xc, y: 250 },
    left_eye: { x: xc - 10, y: 240 },
    right_eye: { x: xc + 10, y: 240 },
    left_ear: { x: xc - 20, y: 245 },
    right_ear: { x: xc + 20, y: 245 },
    left_shoulder: ls,
    right_shoulder: rs,
    left_elbow: le,
    right_elbow: re,
    left_wrist: lw,
    right_wrist: rw,
    left_hip: { x: xc - 50, y: 500 },
    right_hip: { x: xc + 50, y: 500 },
    left_knee: { x: xc - 45, y: 700 },
    right_knee: { x: xc + 55, y: 700 },
    left_ankle: { x: xc - 40, y: 900 },
    right_ankle: { x: xc + 60, y: rightAnkleY },
  };

  const keypoints: Keypoint[] = COCO17_KEYPOINTS.map((name) => ({
    x: pos[name].x,
    y: pos[name].y,
    conf: 0.9,
  }));
  const xs = keypoints.map((k) => k.x);
  const ys = keypoints.map((k) => k.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    idx: f,
    t: f / FPS,
    bbox: [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY],
    keypoints,
  };
}

function syntheticThrow(): SmoothedPose {
  const frames = Array.from({ length: FRAMES }, (_, f) => buildFrame(f));
  return {
    schemaVersion: "1.0",
    jobId: "synthetic-throw",
    modelId: "fabricated",
    modelVersion: "0",
    fps: FPS,
    resolution: { width: 1920, height: 1080 },
    frames,
    temporalVersion: "temporal-1.0.0",
    perFrameQuality: new Array(FRAMES).fill(0.9),
    meanQuality: 0.9,
  };
}

const homography: Homography = {
  matrix: [1 / PPM, 0, 0, 0, 1 / PPM, 0, 0, 0, 1],
  pixelsPerMeter: PPM,
  reprojectionError: 0.01,
  ringDiameterM: 2.135,
};

describe("detectRelease", () => {
  it("finds the constructed wrist-speed peak at frame 60 with elbow extended", () => {
    const r = detectRelease(syntheticThrow(), "right")!;
    expect(r.frame).toBe(60);
    expect(r.elbowExtended).toBe(true);
    expect(r.confidence).toBe(0.9);
    // central difference @60: ((620−520)/2) × 60 = 3000 px/s
    expect(r.wristSpeed).toBeCloseTo(3000, 6);
  });
});

describe("segmentShotPutPhases", () => {
  it("produces the constructed boundaries, contiguous and ordered", () => {
    const pose = syntheticThrow();
    const b = segmentShotPutPhases(pose, 60);
    const byName = Object.fromEntries(b.map((x) => [x.phase, x]));
    expect(byName.entry).toEqual({ phase: "entry", startFrame: 0, endFrame: 20 });
    expect(byName.drive).toEqual({ phase: "drive", startFrame: 21, endFrame: 44 });
    expect(byName.power_position).toEqual({
      phase: "power_position",
      startFrame: 45,
      endFrame: 45,
    });
    expect(byName.delivery).toEqual({ phase: "delivery", startFrame: 45, endFrame: 60 });
    expect(byName.recovery).toEqual({ phase: "recovery", startFrame: 61, endFrame: 119 });
  });
});

describe("runMetricsEngine — calibrated", () => {
  const out = runMetricsEngine({
    pose: syntheticThrow(),
    event: "SHOT_PUT",
    homography,
    hand: "right",
  });

  it("validates its own contract and stamps versions", () => {
    expect(() => MetricsOutputSchema.parse(out)).not.toThrow();
    expect(out.definitionsVersion).toBe("shotput-1.0.0");
    expect(out.calibrated).toBe(true);
    expect(out.quality).toEqual({ meanQuality: 0.9, lowConfidence: false });
  });

  it("every metric carries provenance: unit, confidence, frameRefs", () => {
    for (const [key, m] of Object.entries(out.metrics)) {
      expect(m.unit, key).toBeTruthy();
      expect(m.confidence, key).toBeGreaterThanOrEqual(0);
      if (m.value !== null) {
        expect(m.frameRefs.length, key).toBeGreaterThan(0);
      }
    }
  });

  it("hip–shoulder separation at power position = 50° (constructed peak)", () => {
    const m = out.metrics.hip_shoulder_separation_at_power_position;
    expect(m.value).toBeCloseTo(50, 1);
    expect(m.frameRefs).toEqual([45]);
  });

  it("trunk inclination 0° (constructed vertical trunk)", () => {
    expect(out.metrics.trunk_inclination_at_power_position.value).toBeCloseTo(0, 6);
    expect(out.metrics.trunk_inclination_at_release.value).toBeCloseTo(0, 6);
  });

  it("release velocity 10.00 m/s, angle 0°, height 1.67 m (hand-computed)", () => {
    expect(out.metrics.release_velocity.value).toBeCloseTo(10, 2); // 3000 px/s ÷ 300 px/m
    expect(out.metrics.release_angle.value).toBeCloseTo(0, 6);
    expect(out.metrics.release_height.value).toBeCloseTo((900 - 400) / PPM, 2);
  });

  it("block knee ≈ 180° (constructed straight leg)", () => {
    expect(out.metrics.block_knee_angle_at_release.value).toBeCloseTo(180, 0);
  });

  it("rear-leg sweep ratio 0.5 with evidence inside the drive", () => {
    const m = out.metrics.rear_leg_sweep_height_ratio;
    expect(m.value).toBeCloseTo(0.5, 6);
    expect(m.frameRefs[0]).toBeGreaterThanOrEqual(25);
    expect(m.frameRefs[0]).toBeLessThanOrEqual(35);
  });

  it("COM displacement 1.07 m (320 px ÷ 300 px/m)", () => {
    expect(out.metrics.com_displacement.value).toBeCloseTo(1.07, 2);
  });

  it("phase durations from the constructed boundaries", () => {
    expect(out.metrics.entry_duration.value).toBeCloseTo(21 / 60, 3);
    expect(out.metrics.drive_duration.value).toBeCloseTo(24 / 60, 3);
    expect(out.metrics.delivery_duration.value).toBeCloseTo(16 / 60, 3);
  });
});

describe("runMetricsEngine — uncalibrated", () => {
  it("nulls every calibrated metric instead of guessing", () => {
    const out = runMetricsEngine({
      pose: syntheticThrow(),
      event: "SHOT_PUT",
      homography: null,
    });
    expect(out.calibrated).toBe(false);
    for (const key of [
      "release_velocity",
      "release_angle",
      "release_height",
      "com_displacement",
    ]) {
      expect(out.metrics[key].value, key).toBeNull();
      expect(out.metrics[key].confidence, key).toBe(0);
    }
    // Uncalibrated clips still get angles/timing (PRD F1).
    expect(out.metrics.hip_shoulder_separation_at_power_position.value).not.toBeNull();
    expect(out.metrics.delivery_duration.value).not.toBeNull();
  });
});

describe("pipeline stability + benchmark compatibility (Stage-4 VERIFY)", () => {
  it("is bit-identical across two runs", () => {
    const a = runMetricsEngine({ pose: syntheticThrow(), event: "SHOT_PUT", homography });
    const b = runMetricsEngine({ pose: syntheticThrow(), event: "SHOT_PUT", homography });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("benchmark runner accepts the engine's output as predictions", () => {
    const out = runMetricsEngine({ pose: syntheticThrow(), event: "SHOT_PUT", homography });
    const pose = syntheticThrow();
    const report = runBenchmark([
      {
        clipId: "synthetic-throw",
        pose,
        labels: {
          schemaVersion: "1.0",
          event: "SHOT_PUT",
          fps: FPS,
          totalFrames: FRAMES,
          releaseFrame: 60,
          phaseBoundaries: [{ phase: "delivery", startFrame: 45, endFrame: 60 }],
          keypointGT: [],
          notes: null,
        },
        prediction: {
          releaseFrame: out.metrics.release_frame.value,
          phaseBoundaries: out.phaseBoundaries,
        },
      },
    ]);
    expect(report.clips[0].releaseError).toBe(0);
    expect(report.aggregate.release.withinTolerance).toBe(1);
    expect(report.aggregate.phaseIouMean).toBe(1);
  });
});
