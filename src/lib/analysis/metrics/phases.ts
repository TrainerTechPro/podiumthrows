import type { PhaseBoundary, SmoothedPose } from "@/lib/contracts";
import { comProxy, hipShoulderSeparation } from "./geometry";

/**
 * Shot put phase segmentation (F5): entry → drive → power position →
 * delivery → recovery. Deterministic kinematic heuristics:
 *
 *   drive start   = first frame COM horizontal speed exceeds the threshold
 *                   (person-heights per second — scale- and fps-free)
 *   power position= max hip–shoulder separation in the window before release
 *   delivery      = power position → release
 *   recovery      = after release
 *
 * Initial thresholds are engineering estimates pending the golden-set
 * Phase-2 gate (PRD §11: phase-boundary IoU ≥ 0.85); they live here as
 * named constants so tuning is a one-line diff with benchmark evidence.
 */

export const COM_DRIVE_SPEED_HEIGHTS_PER_S = 0.5; // × person bbox height / s
export const POWER_POSITION_SEARCH_BEFORE_RELEASE_S = 1.0;
export const POWER_POSITION_MIN_BEFORE_RELEASE_S = 0.05;

export function segmentShotPutPhases(
  pose: SmoothedPose,
  releaseFrame: number
): PhaseBoundary[] {
  const lastFrame = pose.frames.length - 1;
  const release = Math.min(releaseFrame, lastFrame);

  // Scale reference: median person bbox height (px) over frames with a bbox.
  const heights = pose.frames
    .map((f) => (f.bbox ? f.bbox[3] : null))
    .filter((h): h is number => h !== null && h > 0)
    .sort((a, b) => a - b);
  const scale = heights.length ? heights[Math.floor(heights.length / 2)] : 1;
  // px per FRAME: heights/s × px/height ÷ frames/s.
  const driveSpeedThreshold = (COM_DRIVE_SPEED_HEIGHTS_PER_S * scale) / pose.fps;

  // Drive start: first sustained COM horizontal motion (2 consecutive frames).
  let driveStart = 0;
  for (let f = 1; f < release - 1; f++) {
    const a = comProxy(pose, f - 1);
    const b = comProxy(pose, f);
    const c = comProxy(pose, f + 1);
    if (a && b && c) {
      const v1 = Math.abs(b.x - a.x);
      const v2 = Math.abs(c.x - b.x);
      if (v1 > driveSpeedThreshold && v2 > driveSpeedThreshold) {
        driveStart = f;
        break;
      }
    }
  }

  // Power position: max separation in [release − 1.0s, release − 0.05s].
  const searchStart = Math.max(
    driveStart,
    release - Math.round(POWER_POSITION_SEARCH_BEFORE_RELEASE_S * pose.fps)
  );
  const searchEnd = Math.max(
    searchStart,
    release - Math.max(1, Math.round(POWER_POSITION_MIN_BEFORE_RELEASE_S * pose.fps))
  );
  let powerFrame = searchEnd;
  let bestSep = -Infinity;
  for (let f = searchStart; f <= searchEnd; f++) {
    const sep = hipShoulderSeparation(pose, f);
    if (sep !== null && sep > bestSep) {
      bestSep = sep;
      powerFrame = f;
    }
  }

  // Assemble contiguous, non-empty, clamped boundaries.
  const boundaries: PhaseBoundary[] = [];
  const entryEnd = Math.max(0, driveStart - 1);
  if (entryEnd >= 0 && driveStart > 0) {
    boundaries.push({ phase: "entry", startFrame: 0, endFrame: entryEnd });
  }
  if (powerFrame > driveStart) {
    boundaries.push({ phase: "drive", startFrame: driveStart, endFrame: powerFrame - 1 });
  }
  boundaries.push({
    phase: "power_position",
    startFrame: Math.min(powerFrame, release),
    endFrame: Math.min(powerFrame, release),
  });
  if (release > powerFrame) {
    boundaries.push({ phase: "delivery", startFrame: powerFrame, endFrame: release });
  }
  if (lastFrame > release) {
    boundaries.push({ phase: "recovery", startFrame: release + 1, endFrame: lastFrame });
  }
  return boundaries;
}

export function findPhase(
  boundaries: PhaseBoundary[],
  phase: string
): PhaseBoundary | null {
  return boundaries.find((b) => b.phase === phase) ?? null;
}
