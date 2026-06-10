import { COCO17_KEYPOINTS, type SmoothedPose, type Keypoint } from "@/lib/contracts";

/**
 * Pure 2D geometry on smoothed keypoints. Every helper returns null rather
 * than a number it can't stand behind (missing/zero-confidence inputs).
 * Angles in degrees. Image y grows downward; "up" is −y.
 */

export const KP_INDEX = Object.fromEntries(
  COCO17_KEYPOINTS.map((n, i) => [n, i])
) as Record<(typeof COCO17_KEYPOINTS)[number], number>;

export const MIN_GEOMETRY_CONF = 0.2;

export function getKp(
  pose: SmoothedPose,
  frame: number,
  name: keyof typeof KP_INDEX
): Keypoint | null {
  const kps = pose.frames[frame]?.keypoints;
  if (!kps) return null;
  const kp = kps[KP_INDEX[name]];
  return kp && kp.conf >= MIN_GEOMETRY_CONF ? kp : null;
}

/** Interior angle at vertex b of the polyline a–b–c, in [0, 180]. */
export function jointAngle(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null,
  c: { x: number; y: number } | null
): number | null {
  if (!a || !b || !c) return null;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  if (n1 === 0 || n2 === 0) return null;
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Orientation of the segment a→b vs image horizontal, in (−180, 180]. */
export function segmentAngleDeg(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null
): number | null {
  if (!a || !b) return null;
  if (a.x === b.x && a.y === b.y) return null;
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

/** Smallest absolute difference between two angles in degrees, in [0, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Hip–shoulder separation at a frame: angle between the shoulder line and the
 * hip line (2D projection — the standard side/rear-45 filming proxy).
 */
export function hipShoulderSeparation(pose: SmoothedPose, frame: number): number | null {
  const shoulder = segmentAngleDeg(
    getKp(pose, frame, "left_shoulder"),
    getKp(pose, frame, "right_shoulder")
  );
  const hip = segmentAngleDeg(getKp(pose, frame, "left_hip"), getKp(pose, frame, "right_hip"));
  if (shoulder === null || hip === null) return null;
  return angleDiff(shoulder, hip);
}

/** Trunk inclination from vertical: 0 = upright, 90 = horizontal. */
export function trunkInclination(pose: SmoothedPose, frame: number): number | null {
  const midShoulder = midpoint(
    getKp(pose, frame, "left_shoulder"),
    getKp(pose, frame, "right_shoulder")
  );
  const midHip = midpoint(getKp(pose, frame, "left_hip"), getKp(pose, frame, "right_hip"));
  const angle = segmentAngleDeg(midHip, midShoulder);
  if (angle === null) return null;
  // Vertical-up is −90° in image coords; inclination is deviation from it.
  return angleDiff(angle, -90);
}

export function midpoint(
  a: { x: number; y: number } | null,
  b: { x: number; y: number } | null
): { x: number; y: number } | null {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Center-of-mass proxy: weighted mid-hip (0.6) + mid-shoulder (0.4). */
export function comProxy(pose: SmoothedPose, frame: number): { x: number; y: number } | null {
  const hip = midpoint(getKp(pose, frame, "left_hip"), getKp(pose, frame, "right_hip"));
  const shoulder = midpoint(
    getKp(pose, frame, "left_shoulder"),
    getKp(pose, frame, "right_shoulder")
  );
  if (!hip || !shoulder) return hip ?? shoulder;
  return { x: 0.6 * hip.x + 0.4 * shoulder.x, y: 0.6 * hip.y + 0.4 * shoulder.y };
}

/** Central-difference speed of a keypoint in px/s at a frame. */
export function kpSpeed(
  pose: SmoothedPose,
  frame: number,
  name: keyof typeof KP_INDEX
): number | null {
  const prev = getKp(pose, Math.max(0, frame - 1), name);
  const next = getKp(pose, Math.min(pose.frames.length - 1, frame + 1), name);
  if (!prev || !next) return null;
  const dtFrames = Math.min(pose.frames.length - 1, frame + 1) - Math.max(0, frame - 1);
  if (dtFrames === 0) return null;
  return (Math.hypot(next.x - prev.x, next.y - prev.y) / dtFrames) * pose.fps;
}

/** Velocity vector of a keypoint in px/s (central difference). */
export function kpVelocity(
  pose: SmoothedPose,
  frame: number,
  name: keyof typeof KP_INDEX
): { vx: number; vy: number } | null {
  const prev = getKp(pose, Math.max(0, frame - 1), name);
  const next = getKp(pose, Math.min(pose.frames.length - 1, frame + 1), name);
  if (!prev || !next) return null;
  const dtFrames = Math.min(pose.frames.length - 1, frame + 1) - Math.max(0, frame - 1);
  if (dtFrames === 0) return null;
  return {
    vx: ((next.x - prev.x) / dtFrames) * pose.fps,
    vy: ((next.y - prev.y) / dtFrames) * pose.fps,
  };
}
