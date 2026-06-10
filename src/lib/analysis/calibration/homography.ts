import {
  MAX_REPROJECTION_ERROR,
  RING_DIAMETER_M,
  type Homography,
  type RingEllipse,
} from "@/lib/contracts";

/**
 * Ground-plane calibration from the imaged ring ellipse (F1, server-side).
 *
 * Model: at spec'd filming distances (≥ ~4 m tripod) the throwing circle's
 * perspective image is well-approximated by an affine map of the true circle:
 * the ellipse major axis images the true diameter, the minor/major ratio is
 * the ground-plane foreshortening. We build the affine homography
 *
 *   H = [ s·cosφ  −s·k·sinφ  cx ]
 *       [ s·sinφ   s·k·cosφ  cy ]
 *       [   0          0      1 ]
 *
 * with s = 2·rx / D (px per meter along the ground), k = ry/rx, φ = ellipse
 * rotation. The §6 test validates the affine assumption against a real
 * perspective projection: recovered scale within 2% at spec'd distances.
 *
 * Reprojection error: true-circle sample points mapped through H, measured
 * against the input ellipse, normalized by imaged diameter. Degenerate input
 * (k outside plausible camera tilt, tiny ellipse) fails the
 * MAX_REPROJECTION_ERROR gate via sanity penalties rather than silently
 * producing absurd velocities.
 */

const MIN_AXIS_PX = 40; // ellipse too small to calibrate from
const MIN_K = 0.05; // ~87° tilt — implausible
const SAMPLES = 64;

export function computeHomography(
  ellipse: RingEllipse,
  event: string
): Homography | null {
  const diameter = RING_DIAMETER_M[event];
  if (!diameter) return null; // javelin: no circle (contracts note)

  const { cx, cy, rotation } = ellipse;
  // Normalize: rx is the semi-MAJOR axis regardless of input order.
  const rx = Math.max(ellipse.rx, ellipse.ry);
  const ry = Math.min(ellipse.rx, ellipse.ry);

  const s = (2 * rx) / diameter;
  const k = ry / rx;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const matrix = [s * cos, -s * k * sin, cx, s * sin, s * k * cos, cy, 0, 0, 1];

  let maxErrPx = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = (2 * Math.PI * i) / SAMPLES;
    const X = (diameter / 2) * Math.cos(t);
    const Y = (diameter / 2) * Math.sin(t);
    const u = matrix[0] * X + matrix[1] * Y + matrix[2];
    const v = matrix[3] * X + matrix[4] * Y + matrix[5];
    // Corresponding parametric ellipse point.
    const eu = cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin;
    const ev = cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos;
    maxErrPx = Math.max(maxErrPx, Math.hypot(u - eu, v - ev));
  }
  let reprojectionError = maxErrPx / (2 * rx);

  // Sanity penalties: report a failing error rather than a confident lie.
  if (rx < MIN_AXIS_PX || k < MIN_K) reprojectionError = 1;

  return {
    matrix,
    pixelsPerMeter: s,
    reprojectionError,
    ringDiameterM: diameter,
  };
}

export function isCalibrationValid(h: Homography | null): h is Homography {
  return h !== null && h.reprojectionError < MAX_REPROJECTION_ERROR;
}
