import { describe, it, expect } from "vitest";
import { COCO17_KEYPOINTS, type PoseOutput } from "@/lib/contracts";
import { tracksFromPose, type Tracks, type TrackPoint } from "../tracks";
import { gateByConfidence } from "../confidence-gate";
import { enforceLeftRight } from "../lr-enforce";
import { interpolateGaps } from "../interpolate";
import { smoothOneEuro } from "../one-euro";
import { computeQuality } from "../quality";
import { runTemporalPipeline } from "../pipeline";

const KP = Object.fromEntries(COCO17_KEYPOINTS.map((n, i) => [n, i]));

function emptyTracks(frameCount: number, fps = 60): Tracks {
  return {
    fps,
    frameCount,
    points: COCO17_KEYPOINTS.map(() => new Array<TrackPoint>(frameCount).fill(null)),
  };
}

describe("gateByConfidence", () => {
  it("nulls points below threshold and keeps the rest untouched", () => {
    const t = emptyTracks(2);
    t.points[KP.nose][0] = { x: 10, y: 10, conf: 0.29 };
    t.points[KP.nose][1] = { x: 11, y: 10, conf: 0.31 };
    const out = gateByConfidence(t, 0.3);
    expect(out.points[KP.nose][0]).toBeNull();
    expect(out.points[KP.nose][1]).toEqual({ x: 11, y: 10, conf: 0.31 });
    // pure: input untouched
    expect(t.points[KP.nose][0]).not.toBeNull();
  });
});

describe("enforceLeftRight — injected swaps are corrected", () => {
  it("corrects a mid-sequence wrist swap and reports the frames", () => {
    const t = emptyTracks(5);
    // Left wrist travels along y=100 (x: 0,10,20,30,40); right along y=200.
    for (let f = 0; f < 5; f++) {
      const lx = f * 10;
      const l = { x: lx, y: 100, conf: 0.9 };
      const r = { x: lx, y: 200, conf: 0.9 };
      // Inject swap at frames 2 and 3.
      if (f === 2 || f === 3) {
        t.points[KP.left_wrist][f] = r;
        t.points[KP.right_wrist][f] = l;
      } else {
        t.points[KP.left_wrist][f] = l;
        t.points[KP.right_wrist][f] = r;
      }
    }
    const { tracks, swappedFrames } = enforceLeftRight(t);
    expect(swappedFrames).toEqual([2, 3]);
    for (let f = 0; f < 5; f++) {
      expect(tracks.points[KP.left_wrist][f]!.y).toBe(100);
      expect(tracks.points[KP.right_wrist][f]!.y).toBe(200);
    }
  });

  it("leaves correctly-assigned crossing trajectories alone", () => {
    // Hands genuinely cross paths: identities must NOT be flipped just
    // because they pass near each other.
    const t = emptyTracks(11);
    for (let f = 0; f <= 10; f++) {
      t.points[KP.left_wrist][f] = { x: f * 10, y: 100 + f, conf: 0.9 };
      t.points[KP.right_wrist][f] = { x: 100 - f * 10, y: 100 - f, conf: 0.9 };
    }
    const { swappedFrames } = enforceLeftRight(t);
    expect(swappedFrames).toEqual([]);
  });
});

describe("interpolateGaps — fills short gaps, refuses long ones", () => {
  it("fills a 3-frame gap on a linear trajectory exactly", () => {
    const t = emptyTracks(8);
    for (const f of [0, 1, 2, 6, 7]) {
      t.points[KP.nose][f] = { x: f * 10, y: 50, conf: 0.9 };
    }
    const out = interpolateGaps(t, 4);
    for (const f of [3, 4, 5]) {
      const p = out.points[KP.nose][f]!;
      expect(p.x).toBeCloseTo(f * 10, 6); // Catmull-Rom is exact on linear data
      expect(p.y).toBeCloseTo(50, 6);
      expect(p.conf).toBeCloseTo(0.72, 6); // 0.8 × min(0.9, 0.9)
    }
  });

  it("leaves gaps longer than maxGap as null", () => {
    const t = emptyTracks(12);
    t.points[KP.nose][0] = { x: 0, y: 0, conf: 0.9 };
    t.points[KP.nose][11] = { x: 110, y: 0, conf: 0.9 };
    const out = interpolateGaps(t, 8); // gap of 10 > 8
    for (let f = 1; f <= 10; f++) expect(out.points[KP.nose][f]).toBeNull();
  });

  it("leaves leading/trailing gaps alone (no extrapolation)", () => {
    const t = emptyTracks(6);
    t.points[KP.nose][2] = { x: 0, y: 0, conf: 0.9 };
    t.points[KP.nose][3] = { x: 1, y: 0, conf: 0.9 };
    const out = interpolateGaps(t, 8);
    expect(out.points[KP.nose][0]).toBeNull();
    expect(out.points[KP.nose][5]).toBeNull();
  });
});

describe("smoothOneEuro", () => {
  it("reduces jitter variance on a noisy constant signal", () => {
    const t = emptyTracks(100);
    // Deterministic "noise": alternating ±2px around x=100.
    for (let f = 0; f < 100; f++) {
      t.points[KP.nose][f] = { x: 100 + (f % 2 === 0 ? 2 : -2), y: 50, conf: 0.9 };
    }
    const out = smoothOneEuro(t);
    const rawDev = 2;
    const smoothedDevs = out.points[KP.nose]
      .slice(10)
      .map((p) => Math.abs(p!.x - 100));
    const maxDev = Math.max(...smoothedDevs);
    expect(maxDev).toBeLessThan(rawDev * 0.5);
  });

  it("tracks a fast ramp without gross lag (beta term)", () => {
    const t = emptyTracks(60);
    for (let f = 0; f < 60; f++) {
      t.points[KP.nose][f] = { x: f * 20, y: 0, conf: 0.9 }; // 1200 px/s at 60fps
    }
    const out = smoothOneEuro(t);
    const lag = 59 * 20 - out.points[KP.nose][59]!.x;
    expect(lag).toBeLessThan(40); // < 2 frames of motion
  });

  it("resets across gaps instead of bridging them", () => {
    const t = emptyTracks(20);
    for (let f = 0; f < 5; f++) t.points[KP.nose][f] = { x: 0, y: 0, conf: 0.9 };
    for (let f = 15; f < 20; f++) t.points[KP.nose][f] = { x: 500, y: 0, conf: 0.9 };
    const out = smoothOneEuro(t);
    // First sample after the gap must be exactly the new position (fresh state),
    // not dragged toward the pre-gap position.
    expect(out.points[KP.nose][15]!.x).toBe(500);
    for (let f = 5; f < 15; f++) expect(out.points[KP.nose][f]).toBeNull();
  });
});

describe("computeQuality", () => {
  it("computes exact per-frame and mean quality", () => {
    const t = emptyTracks(2);
    // Frame 0: one landmark at conf 0.85 → 0.85/17. Frame 1: nothing → 0.
    t.points[KP.nose][0] = { x: 0, y: 0, conf: 0.85 };
    const q = computeQuality(t, 0.5);
    expect(q.perFrame[0]).toBeCloseTo(0.85 / 17, 10);
    expect(q.perFrame[1]).toBe(0);
    expect(q.mean).toBeCloseTo(0.85 / 34, 10);
    expect(q.lowConfidence).toBe(true);
  });
});

describe("runTemporalPipeline — determinism", () => {
  function syntheticPose(): PoseOutput {
    const frames: PoseOutput["frames"] = [];
    for (let f = 0; f < 40; f++) {
      const keypoints = COCO17_KEYPOINTS.map((_, ki) => ({
        x: 100 + ki * 5 + f * 2 + (f % 3), // deterministic wobble
        y: 200 + ki * 7 + Math.sin(f / 5) * 4,
        conf: f === 20 && ki === KP.left_ankle ? 0.1 : 0.9, // one gated point
      }));
      frames.push({ idx: f, t: f / 60, bbox: [0, 0, 400, 600], keypoints });
    }
    return {
      schemaVersion: "1.0",
      jobId: "t",
      modelId: "fabricated",
      modelVersion: "0",
      fps: 60,
      resolution: { width: 1920, height: 1080 },
      frames,
    };
  }

  it("is bit-identical across two runs (JSON-stringify equal)", () => {
    const a = runTemporalPipeline(syntheticPose());
    const b = runTemporalPipeline(syntheticPose());
    expect(JSON.stringify(a.smoothed)).toBe(JSON.stringify(b.smoothed));
  });

  it("emits a contract-valid SmoothedPose with 17-slot frames", async () => {
    const { SmoothedPoseSchema } = await import("@/lib/contracts");
    const { smoothed } = runTemporalPipeline(syntheticPose());
    expect(() => SmoothedPoseSchema.parse(smoothed)).not.toThrow();
    expect(smoothed.frames[0].keypoints).toHaveLength(17);
    expect(smoothed.perFrameQuality).toHaveLength(40);
  });

  it("interpolates the gated landmark (conf reflects interpolation, not 0)", () => {
    const { smoothed } = runTemporalPipeline(syntheticPose());
    const kp = smoothed.frames[20].keypoints![KP.left_ankle];
    expect(kp.conf).toBeGreaterThan(0); // filled from neighbors
    expect(kp.conf).toBeLessThan(0.9); // but marked below measured confidence
  });
});

describe("tracksFromPose", () => {
  it("transposes frames → per-landmark tracks", () => {
    const pose: PoseOutput = {
      schemaVersion: "1.0",
      jobId: "t",
      modelId: "m",
      modelVersion: "0",
      fps: 30,
      resolution: { width: 100, height: 100 },
      frames: [
        {
          idx: 0,
          t: 0,
          bbox: [0, 0, 10, 10],
          keypoints: COCO17_KEYPOINTS.map((_, ki) => ({ x: ki, y: ki * 2, conf: 0.5 })),
        },
        { idx: 1, t: 1 / 30, bbox: null, keypoints: null },
      ],
    };
    const tracks = tracksFromPose(pose);
    expect(tracks.points[KP.left_wrist][0]).toEqual({
      x: KP.left_wrist,
      y: KP.left_wrist * 2,
      conf: 0.5,
    });
    expect(tracks.points[KP.left_wrist][1]).toBeNull();
  });
});
