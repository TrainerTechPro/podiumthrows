import { cloneTracks, type Tracks } from "./tracks";

/**
 * F4 step 3 — gap interpolation: spline fill across occlusion windows of
 * ≤ maxGap frames. Longer gaps stay null and downstream metrics mark affected
 * instants low-confidence.
 *
 * Catmull-Rom through the four anchors around the gap (falls back to linear
 * when there's no outer context). Interpolated confidence = 0.8 × the lesser
 * endpoint confidence, so interpolated instants always rank below measured.
 */

export const DEFAULT_MAX_GAP_FRAMES = 8;
const INTERP_CONF_FACTOR = 0.8;

/**
 * Cubic Hermite across the gap [p1 … p2] with endpoint slopes in px/frame
 * (m1 from the frame before p1, m2 from the frame after p2). Unlike uniform
 * Catmull-Rom, this is exact on linear motion regardless of gap length.
 */
function hermite(
  p1: number,
  m1: number,
  p2: number,
  m2: number,
  s: number,
  h: number
): number {
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return h00 * p1 + h10 * h * m1 + h01 * p2 + h11 * h * m2;
}

export function interpolateGaps(
  tracks: Tracks,
  maxGap: number = DEFAULT_MAX_GAP_FRAMES
): Tracks {
  const out = cloneTracks(tracks);

  for (const track of out.points) {
    let f = 0;
    while (f < track.length) {
      if (track[f] !== null) {
        f++;
        continue;
      }
      const gapStart = f;
      while (f < track.length && track[f] === null) f++;
      const gapEnd = f - 1; // inclusive
      const before = gapStart - 1;
      const after = f;
      const gapLen = gapEnd - gapStart + 1;
      if (before < 0 || after >= track.length || gapLen > maxGap) continue;

      const p1 = track[before]!;
      const p2 = track[after]!;
      const h = after - before;
      const prev = before - 1 >= 0 ? track[before - 1] : null;
      const next = after + 1 < track.length ? track[after + 1] : null;
      // Endpoint slopes in px/frame; default to the gap's own secant.
      const m1x = prev ? p1.x - prev.x : (p2.x - p1.x) / h;
      const m1y = prev ? p1.y - prev.y : (p2.y - p1.y) / h;
      const m2x = next ? next.x - p2.x : (p2.x - p1.x) / h;
      const m2y = next ? next.y - p2.y : (p2.y - p1.y) / h;
      const conf = INTERP_CONF_FACTOR * Math.min(p1.conf, p2.conf);

      for (let g = gapStart; g <= gapEnd; g++) {
        const s = (g - before) / h;
        track[g] = {
          x: hermite(p1.x, m1x, p2.x, m2x, s, h),
          y: hermite(p1.y, m1y, p2.y, m2y, s, h),
          conf,
        };
      }
    }
  }

  return out;
}
