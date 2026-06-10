import { describe, it, expect } from "vitest";
import { computeHomography, isCalibrationValid } from "../homography";
import type { RingEllipse } from "@/lib/contracts";

/**
 * Stage-6 VERIFY: homography vs a SYNTHETIC PERSPECTIVE CAMERA — not the
 * affine model's own output. A known 2.135 m circle is projected through a
 * real pinhole camera at tripod pitch; the ellipse is fit from the projected
 * points by extents; the recovered pixelsPerMeter must match the camera's
 * true scale (f/Z at ring center) within 2%.
 */

const RING_D = 2.135;

/** Project ground circle (radius R at origin) through a pinhole camera. */
function projectCircle(args: {
  focalPx: number;
  camHeightM: number;
  camDistM: number; // horizontal distance to ring center
  pitchRad: number; // downward tilt
}): { points: Array<{ u: number; v: number }>; centerDepth: number } {
  const { focalPx, camHeightM, camDistM, pitchRad } = args;
  const points: Array<{ u: number; v: number }> = [];
  const cp = Math.cos(pitchRad);
  const sp = Math.sin(pitchRad);
  for (let i = 0; i < 360; i++) {
    const t = (i * Math.PI) / 180;
    // World: ground plane y=0; camera at (0, camHeightM, 0) looking +z,
    // tilted down by pitch. Camera-frame = rotate (P − cam) around x.
    const wx = (RING_D / 2) * Math.cos(t);
    const wz = camDistM + (RING_D / 2) * Math.sin(t);
    const yRel = -camHeightM;
    const zRel = wz;
    const xCam = wx;
    const yCam = yRel * cp + zRel * sp;
    const zCam = -yRel * sp + zRel * cp;
    points.push({ u: (focalPx * xCam) / zCam, v: (focalPx * yCam) / zCam });
  }
  // Depth of ring center in camera frame.
  const zc = camHeightM * sp + camDistM * cp;
  return { points, centerDepth: zc };
}

function fitEllipseByExtents(points: Array<{ u: number; v: number }>): RingEllipse {
  // Major axis: max pairwise distance (robust for convex point sets).
  let major = 0;
  let pa = points[0];
  let pb = points[0];
  for (let i = 0; i < points.length; i += 4) {
    for (let j = i + 1; j < points.length; j += 4) {
      const d = Math.hypot(points[i].u - points[j].u, points[i].v - points[j].v);
      if (d > major) {
        major = d;
        pa = points[i];
        pb = points[j];
      }
    }
  }
  const cx = points.reduce((s, p) => s + p.u, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.v, 0) / points.length;
  const rotation = Math.atan2(pb.v - pa.v, pb.u - pa.u);
  // Minor axis: max distance perpendicular to the major direction.
  const ux = Math.cos(rotation);
  const uy = Math.sin(rotation);
  let minor = 0;
  for (const p of points) {
    const perp = Math.abs(-(p.u - cx) * uy + (p.v - cy) * ux);
    minor = Math.max(minor, perp);
  }
  return { cx, cy, rx: major / 2, ry: minor, rotation };
}

describe("computeHomography vs synthetic perspective camera", () => {
  it("recovers scale within 2% at a spec'd tripod setup (rear-45°, 6 m)", () => {
    const focalPx = 1600; // ~iPhone main lens at 1080p
    const cam = { focalPx, camHeightM: 1.4, camDistM: 6, pitchRad: (12 * Math.PI) / 180 };
    const { points, centerDepth } = projectCircle(cam);
    const ellipse = fitEllipseByExtents(points);

    const h = computeHomography(ellipse, "SHOT_PUT")!;
    expect(h).not.toBeNull();
    const trueScale = focalPx / centerDepth; // px per meter at ring center
    const relErr = Math.abs(h.pixelsPerMeter - trueScale) / trueScale;
    expect(relErr).toBeLessThan(0.02);
    expect(isCalibrationValid(h)).toBe(true);
  });

  it("recovers scale within 2% at the spec'd minimum distance (5 m, 16°)", () => {
    // Measured boundary of the affine model: scale error ≈ D/(2Z), which
    // crosses 2% at ~5 m. MIN_TRIPOD_DISTANCE_M = 5 in the wizard position
    // config exists BECAUSE of this measurement — closer setups cannot pass
    // the F1 acceptance criterion.
    const focalPx = 1400;
    const cam = { focalPx, camHeightM: 1.5, camDistM: 5, pitchRad: (16 * Math.PI) / 180 };
    const { points, centerDepth } = projectCircle(cam);
    const ellipse = fitEllipseByExtents(points);
    const h = computeHomography(ellipse, "SHOT_PUT")!;
    const trueScale = focalPx / centerDepth;
    expect(Math.abs(h.pixelsPerMeter - trueScale) / trueScale).toBeLessThan(0.02);
  });

  it("documents that 4 m is OUTSIDE the calibrated envelope (error > 2%)", () => {
    const focalPx = 1400;
    const cam = { focalPx, camHeightM: 1.6, camDistM: 4, pitchRad: (20 * Math.PI) / 180 };
    const { points, centerDepth } = projectCircle(cam);
    const ellipse = fitEllipseByExtents(points);
    const h = computeHomography(ellipse, "SHOT_PUT")!;
    const trueScale = focalPx / centerDepth;
    expect(Math.abs(h.pixelsPerMeter - trueScale) / trueScale).toBeGreaterThan(0.02);
  });

  it("uses the discus diameter for discus", () => {
    const e: RingEllipse = { cx: 0, cy: 0, rx: 500, ry: 200, rotation: 0 };
    const shot = computeHomography(e, "SHOT_PUT")!;
    const disc = computeHomography(e, "DISCUS")!;
    expect(shot.pixelsPerMeter / disc.pixelsPerMeter).toBeCloseTo(2.5 / 2.135, 6);
  });

  it("returns null for events without a circle", () => {
    const e: RingEllipse = { cx: 0, cy: 0, rx: 500, ry: 200, rotation: 0 };
    expect(computeHomography(e, "JAVELIN")).toBeNull();
  });

  it("fails the validity gate on degenerate ellipses instead of lying", () => {
    const tiny = computeHomography({ cx: 0, cy: 0, rx: 12, ry: 8, rotation: 0 }, "SHOT_PUT")!;
    expect(isCalibrationValid(tiny)).toBe(false);
    const sliver = computeHomography({ cx: 0, cy: 0, rx: 500, ry: 2, rotation: 0 }, "SHOT_PUT")!;
    expect(isCalibrationValid(sliver)).toBe(false);
  });

  it("normalizes swapped axes (ry > rx input)", () => {
    const a = computeHomography({ cx: 0, cy: 0, rx: 200, ry: 500, rotation: 0 }, "SHOT_PUT")!;
    const b = computeHomography({ cx: 0, cy: 0, rx: 500, ry: 200, rotation: 0 }, "SHOT_PUT")!;
    expect(a.pixelsPerMeter).toBeCloseTo(b.pixelsPerMeter, 9);
  });
});
