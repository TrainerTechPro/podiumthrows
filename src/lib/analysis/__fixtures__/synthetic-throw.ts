import {
  COCO17_KEYPOINTS,
  type Homography,
  type Keypoint,
  type SmoothedPose,
} from "@/lib/contracts";

/**
 * Canonical synthetic shot put throw used by metrics, report, and e2e fixture
 * tests. Geometry is hand-constructed so expected metric values are exact:
 *  - 120 frames @60fps, all keypoints conf 0.9
 *  - body translates +8 px/frame in x from frame 21
 *  - hip–shoulder separation ramps 0→50° peaking at frame 45, decays to 10°
 *  - right-wrist central-difference speed peaks exactly at frame 60
 *  - right elbow always on the shoulder–wrist segment (extension ≈ 180°)
 *  - block (left) leg nearly straight at release
 *  - right ankle sweeps to 0.5 leg-lengths during frames 25–35
 */

export const FIXTURE_FPS = 60;
export const FIXTURE_FRAMES = 120;
export const FIXTURE_PPM = 300;

function wristX(f: number): number {
  if (f <= 58) return 500;
  if (f === 59) return 520;
  if (f === 60) return 560;
  if (f === 61) return 620;
  return 650;
}

function shoulderTheta(f: number): number {
  if (f < 20) return 0;
  if (f <= 45) return ((f - 20) / 25) * 50;
  if (f <= 57) return 50 - ((f - 45) / 12) * 40;
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
    t: f / FIXTURE_FPS,
    bbox: [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY],
    keypoints,
  };
}

export function syntheticThrow(): SmoothedPose {
  const frames = Array.from({ length: FIXTURE_FRAMES }, (_, f) => buildFrame(f));
  return {
    schemaVersion: "1.0",
    jobId: "synthetic-throw",
    modelId: "fabricated",
    modelVersion: "0",
    fps: FIXTURE_FPS,
    resolution: { width: 1920, height: 1080 },
    frames,
    temporalVersion: "temporal-1.0.0",
    perFrameQuality: new Array(FIXTURE_FRAMES).fill(0.9),
    meanQuality: 0.9,
  };
}

export const fixtureHomography: Homography = {
  matrix: [1 / FIXTURE_PPM, 0, 0, 0, 1 / FIXTURE_PPM, 0, 0, 0, 1],
  pixelsPerMeter: FIXTURE_PPM,
  reprojectionError: 0.01,
  ringDiameterM: 2.135,
};
