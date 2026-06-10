import type {
  Homography,
  MetricValue,
  PhaseBoundary,
  SmoothedPose,
} from "@/lib/contracts";
import {
  comProxy,
  getKp,
  hipShoulderSeparation,
  jointAngle,
  kpVelocity,
  trunkInclination,
} from "../geometry";
import { detectRelease, type Hand } from "../release";
import { segmentShotPutPhases, findPhase } from "../phases";

/**
 * Shot put v1 metric definitions (PRD F5 — the reference event).
 * Every metric: { value, unit, confidence, frameRefs } — no metric without
 * provenance. Calibrated metrics (velocity, height, displacement, release
 * angle) are null without a valid homography: "requires calibration" is a
 * product state, never a guessed number.
 */

export const SHOTPUT_DEFINITIONS_VERSION = "shotput-1.0.0";

export interface ShotPutMetricsResult {
  metrics: Record<string, MetricValue>;
  phaseBoundaries: PhaseBoundary[];
}

function metersPerPixel(homography: Homography | null): number | null {
  if (!homography) return null;
  return 1 / homography.pixelsPerMeter;
}

function nullMetric(unit: MetricValue["unit"]): MetricValue {
  return { value: null, unit, confidence: 0, frameRefs: [] };
}

function frameConf(pose: SmoothedPose, frame: number): number {
  return pose.perFrameQuality[frame] ?? 0;
}

export function computeShotPutMetrics(
  pose: SmoothedPose,
  opts: { homography: Homography | null; hand?: Hand }
): ShotPutMetricsResult {
  const hand: Hand = opts.hand ?? "right";
  const mPerPx = metersPerPixel(opts.homography);
  const metrics: Record<string, MetricValue> = {};

  const release = detectRelease(pose, hand);
  if (!release) {
    // Without a release frame nothing downstream is meaningful; emit the
    // full metric set as nulls so the report renders "not measurable".
    return {
      metrics: {
        release_frame: nullMetric("frame"),
        hip_shoulder_separation_at_power_position: nullMetric("deg"),
        trunk_inclination_at_power_position: nullMetric("deg"),
        trunk_inclination_at_release: nullMetric("deg"),
        release_angle: nullMetric("deg"),
        release_height: nullMetric("m"),
        release_velocity: nullMetric("m/s"),
        block_knee_angle_at_release: nullMetric("deg"),
        rear_leg_sweep_height_ratio: nullMetric("ratio"),
        com_displacement: nullMetric("m"),
        entry_duration: nullMetric("s"),
        drive_duration: nullMetric("s"),
        delivery_duration: nullMetric("s"),
      },
      phaseBoundaries: [],
    };
  }

  const phaseBoundaries = segmentShotPutPhases(pose, release.frame);
  const power = findPhase(phaseBoundaries, "power_position");
  const powerFrame = power?.startFrame ?? Math.max(0, release.frame - 1);

  metrics.release_frame = {
    value: release.frame,
    unit: "frame",
    confidence: release.confidence,
    frameRefs: [release.frame],
  };

  const sep = hipShoulderSeparation(pose, powerFrame);
  metrics.hip_shoulder_separation_at_power_position =
    sep === null
      ? nullMetric("deg")
      : {
          value: round1(sep),
          unit: "deg",
          confidence: frameConf(pose, powerFrame),
          frameRefs: [powerFrame],
        };

  const trunkPP = trunkInclination(pose, powerFrame);
  metrics.trunk_inclination_at_power_position =
    trunkPP === null
      ? nullMetric("deg")
      : {
          value: round1(trunkPP),
          unit: "deg",
          confidence: frameConf(pose, powerFrame),
          frameRefs: [powerFrame],
        };

  const trunkRel = trunkInclination(pose, release.frame);
  metrics.trunk_inclination_at_release =
    trunkRel === null
      ? nullMetric("deg")
      : {
          value: round1(trunkRel),
          unit: "deg",
          confidence: frameConf(pose, release.frame),
          frameRefs: [release.frame],
        };

  // ── Calibrated metrics ────────────────────────────────────────────────
  const wrist = hand === "right" ? "right_wrist" : "left_wrist";
  const vel = kpVelocity(pose, release.frame, wrist);

  if (mPerPx !== null && vel !== null) {
    const speedMs = Math.hypot(vel.vx, vel.vy) * mPerPx;
    // Image y grows downward: upward velocity is −vy.
    const angle = (Math.atan2(-vel.vy, Math.abs(vel.vx)) * 180) / Math.PI;
    metrics.release_velocity = {
      value: round2(speedMs),
      unit: "m/s",
      confidence: Math.min(release.confidence, frameConf(pose, release.frame)),
      frameRefs: [release.frame],
    };
    metrics.release_angle = {
      value: round1(angle),
      unit: "deg",
      confidence: Math.min(release.confidence, frameConf(pose, release.frame)),
      frameRefs: [release.frame],
    };
  } else {
    metrics.release_velocity = nullMetric("m/s");
    metrics.release_angle = nullMetric("deg");
  }

  const wristAtRelease = getKp(pose, release.frame, wrist);
  const ankleL = getKp(pose, release.frame, "left_ankle");
  const ankleR = getKp(pose, release.frame, "right_ankle");
  const groundY =
    ankleL && ankleR ? Math.max(ankleL.y, ankleR.y) : (ankleL ?? ankleR)?.y ?? null;
  if (mPerPx !== null && wristAtRelease && groundY !== null) {
    metrics.release_height = {
      value: round2((groundY - wristAtRelease.y) * mPerPx),
      unit: "m",
      confidence: frameConf(pose, release.frame),
      frameRefs: [release.frame],
    };
  } else {
    metrics.release_height = nullMetric("m");
  }

  // Block-leg knee angle at release (block leg = opposite the throwing hand).
  const side = hand === "right" ? "left" : "right";
  const knee = jointAngle(
    getKp(pose, release.frame, `${side}_hip`),
    getKp(pose, release.frame, `${side}_knee`),
    getKp(pose, release.frame, `${side}_ankle`)
  );
  metrics.block_knee_angle_at_release =
    knee === null
      ? nullMetric("deg")
      : {
          value: round1(knee),
          unit: "deg",
          confidence: frameConf(pose, release.frame),
          frameRefs: [release.frame],
        };

  // Rear-leg sweep height during drive, as a fraction of hip height
  // (scale-free: works uncalibrated). Rear leg = throwing-hand side.
  const drive = findPhase(phaseBoundaries, "drive");
  metrics.rear_leg_sweep_height_ratio = (() => {
    if (!drive) return nullMetric("ratio");
    const rearAnkle = hand === "right" ? "right_ankle" : "left_ankle";
    let best: { ratio: number; frame: number } | null = null;
    for (let f = drive.startFrame; f <= drive.endFrame; f++) {
      const ankle = getKp(pose, f, rearAnkle);
      const hipL = getKp(pose, f, "left_hip");
      const hipR = getKp(pose, f, "right_hip");
      const stanceAnkle = getKp(pose, f, hand === "right" ? "left_ankle" : "right_ankle");
      if (!ankle || !hipL || !hipR || !stanceAnkle) continue;
      const hipY = (hipL.y + hipR.y) / 2;
      const legLen = Math.abs(stanceAnkle.y - hipY);
      if (legLen === 0) continue;
      const lift = (stanceAnkle.y - ankle.y) / legLen; // + = swept above stance foot
      if (!best || lift > best.ratio) best = { ratio: lift, frame: f };
    }
    if (!best) return nullMetric("ratio");
    return {
      value: round2(best.ratio),
      unit: "ratio",
      confidence: frameConf(pose, best.frame),
      frameRefs: [best.frame],
    };
  })();

  // COM displacement across the circle (calibrated).
  const first = comProxy(pose, 0);
  const last = comProxy(pose, release.frame);
  if (mPerPx !== null && first && last) {
    metrics.com_displacement = {
      value: round2(Math.hypot(last.x - first.x, last.y - first.y) * mPerPx),
      unit: "m",
      confidence: Math.min(frameConf(pose, 0), frameConf(pose, release.frame)),
      frameRefs: [0, release.frame],
    };
  } else {
    metrics.com_displacement = nullMetric("m");
  }

  // Phase durations.
  for (const phaseName of ["entry", "drive", "delivery"] as const) {
    const b = findPhase(phaseBoundaries, phaseName);
    metrics[`${phaseName}_duration`] = b
      ? {
          value: round3((b.endFrame - b.startFrame + 1) / pose.fps),
          unit: "s",
          confidence: release.confidence,
          frameRefs: [b.startFrame, b.endFrame],
        }
      : nullMetric("s");
  }

  return { metrics, phaseBoundaries };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
