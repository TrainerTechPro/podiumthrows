/**
 * Throws-specific angle calculations built on top of the existing
 * MediaPipe pose detection infrastructure in src/components/video/usePoseDetection.ts
 *
 * Provides:
 * - calculateThrowAngles(): computes all key biomechanical angles from landmarks
 * - ANGLE_OPTIMAL_RANGES: defines green/amber/red ranges per angle per event
 * - getAngleStatus(): returns "optimal" | "marginal" | "concerning" for a given angle
 */

import {
  type PoseLandmark,
  POSE_LANDMARKS,
  calculateAngle,
} from "@/components/video/usePoseDetection";

/* ─── Types ────────────────────────────────────────────────────────────────── */

export type AngleStatus = "optimal" | "marginal" | "concerning";

export type ThrowAngleResult = {
  key: string;
  label: string;
  degrees: number;
  status: AngleStatus;
};

export type ThrowAngles = {
  shoulderSeparation: number;
  hipShoulderDifferential: number;
  blockLegKnee: number;
  rearLegKnee: number;
  trunkLean: number;
  leftElbow: number;
  rightElbow: number;
  leftShoulder: number;
  rightShoulder: number;
  leftHip: number;
  rightHip: number;
};

export type KeyPosition = {
  timestamp: number;
  label: string;
  angles: ThrowAngles;
  notes: string;
  thumbnailDataUrl?: string;
};

/* ─── Optimal Angle Ranges ─────────────────────────────────────────────────── */

type AngleRange = { min: number; max: number };

type AngleRanges = {
  optimal: AngleRange;
  marginal: AngleRange;
};

/**
 * Default optimal ranges for throws biomechanics.
 * Green = optimal, Amber = marginal (outside optimal but inside marginal), Red = concerning (outside both).
 */
const DEFAULT_RANGES: Record<string, AngleRanges> = {
  shoulderSeparation: {
    optimal: { min: 150, max: 180 },
    marginal: { min: 130, max: 180 },
  },
  hipShoulderDifferential: {
    optimal: { min: 30, max: 60 },
    marginal: { min: 15, max: 75 },
  },
  blockLegKnee: {
    optimal: { min: 160, max: 180 },
    marginal: { min: 140, max: 180 },
  },
  rearLegKnee: {
    optimal: { min: 90, max: 140 },
    marginal: { min: 70, max: 160 },
  },
  trunkLean: {
    optimal: { min: 75, max: 100 },
    marginal: { min: 60, max: 115 },
  },
  leftElbow: {
    optimal: { min: 80, max: 180 },
    marginal: { min: 60, max: 180 },
  },
  rightElbow: {
    optimal: { min: 80, max: 180 },
    marginal: { min: 60, max: 180 },
  },
  leftShoulder: {
    optimal: { min: 60, max: 150 },
    marginal: { min: 40, max: 170 },
  },
  rightShoulder: {
    optimal: { min: 60, max: 150 },
    marginal: { min: 40, max: 170 },
  },
  leftHip: {
    optimal: { min: 80, max: 160 },
    marginal: { min: 60, max: 170 },
  },
  rightHip: {
    optimal: { min: 80, max: 160 },
    marginal: { min: 60, max: 170 },
  },
};

/* ─── Helper: angle between three points ─────────────────────────────────── */

function angleBetween(
  landmarks: PoseLandmark[],
  a: number,
  b: number,
  c: number
): number {
  if (a >= landmarks.length || b >= landmarks.length || c >= landmarks.length) return 0;
  return calculateAngle(landmarks[a], landmarks[b], landmarks[c]);
}

/* ─── Shoulder Separation ────────────────────────────────────────────────── */

function calcShoulderSeparation(lm: PoseLandmark[]): number {
  // Angle at the midpoint of the shoulder line relative to a vertical reference
  // Simplified: angle across left shoulder - mid spine - right shoulder
  const midX = (lm[POSE_LANDMARKS.LEFT_SHOULDER].x + lm[POSE_LANDMARKS.RIGHT_SHOULDER].x) / 2;
  const midY = (lm[POSE_LANDMARKS.LEFT_SHOULDER].y + lm[POSE_LANDMARKS.RIGHT_SHOULDER].y) / 2;
  const midSpine: PoseLandmark = { x: midX, y: midY, z: 0, visibility: 1 };
  return calculateAngle(lm[POSE_LANDMARKS.LEFT_SHOULDER], midSpine, lm[POSE_LANDMARKS.RIGHT_SHOULDER]);
}

/* ─── Hip-Shoulder Differential ──────────────────────────────────────────── */

function calcHipShoulderDiff(lm: PoseLandmark[]): number {
  // Angle between the hip line and shoulder line (separation = power)
  const shoulderAngle = Math.atan2(
    lm[POSE_LANDMARKS.RIGHT_SHOULDER].y - lm[POSE_LANDMARKS.LEFT_SHOULDER].y,
    lm[POSE_LANDMARKS.RIGHT_SHOULDER].x - lm[POSE_LANDMARKS.LEFT_SHOULDER].x
  );
  const hipAngle = Math.atan2(
    lm[POSE_LANDMARKS.RIGHT_HIP].y - lm[POSE_LANDMARKS.LEFT_HIP].y,
    lm[POSE_LANDMARKS.RIGHT_HIP].x - lm[POSE_LANDMARKS.LEFT_HIP].x
  );
  let diff = Math.abs((shoulderAngle - hipAngle) * 180 / Math.PI);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/* ─── Trunk Lean ─────────────────────────────────────────────────────────── */

function calcTrunkLean(lm: PoseLandmark[]): number {
  // Angle of the torso (mid-hip to mid-shoulder) relative to vertical
  const midHipX = (lm[POSE_LANDMARKS.LEFT_HIP].x + lm[POSE_LANDMARKS.RIGHT_HIP].x) / 2;
  const midHipY = (lm[POSE_LANDMARKS.LEFT_HIP].y + lm[POSE_LANDMARKS.RIGHT_HIP].y) / 2;
  const midShoulderX = (lm[POSE_LANDMARKS.LEFT_SHOULDER].x + lm[POSE_LANDMARKS.RIGHT_SHOULDER].x) / 2;
  const midShoulderY = (lm[POSE_LANDMARKS.LEFT_SHOULDER].y + lm[POSE_LANDMARKS.RIGHT_SHOULDER].y) / 2;

  // Angle from vertical (straight up = 180 degrees)
  const dx = midShoulderX - midHipX;
  const dy = midShoulderY - midHipY; // Note: y is inverted in screen coords
  const angleFromVertical = Math.abs(Math.atan2(dx, -dy) * 180 / Math.PI);
  return 180 - angleFromVertical; // Convert so upright ≈ 90°
}

/* ─── Main: calculateThrowAngles ─────────────────────────────────────────── */

export function calculateThrowAngles(landmarks: PoseLandmark[]): ThrowAngles {
  if (!landmarks || landmarks.length < 33) {
    return {
      shoulderSeparation: 0,
      hipShoulderDifferential: 0,
      blockLegKnee: 0,
      rearLegKnee: 0,
      trunkLean: 0,
      leftElbow: 0,
      rightElbow: 0,
      leftShoulder: 0,
      rightShoulder: 0,
      leftHip: 0,
      rightHip: 0,
    };
  }

  return {
    shoulderSeparation: calcShoulderSeparation(landmarks),
    hipShoulderDifferential: calcHipShoulderDiff(landmarks),
    blockLegKnee: angleBetween(
      landmarks,
      POSE_LANDMARKS.LEFT_HIP,
      POSE_LANDMARKS.LEFT_KNEE,
      POSE_LANDMARKS.LEFT_ANKLE
    ),
    rearLegKnee: angleBetween(
      landmarks,
      POSE_LANDMARKS.RIGHT_HIP,
      POSE_LANDMARKS.RIGHT_KNEE,
      POSE_LANDMARKS.RIGHT_ANKLE
    ),
    trunkLean: calcTrunkLean(landmarks),
    leftElbow: angleBetween(
      landmarks,
      POSE_LANDMARKS.LEFT_SHOULDER,
      POSE_LANDMARKS.LEFT_ELBOW,
      POSE_LANDMARKS.LEFT_WRIST
    ),
    rightElbow: angleBetween(
      landmarks,
      POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.RIGHT_ELBOW,
      POSE_LANDMARKS.RIGHT_WRIST
    ),
    leftShoulder: angleBetween(
      landmarks,
      POSE_LANDMARKS.LEFT_ELBOW,
      POSE_LANDMARKS.LEFT_SHOULDER,
      POSE_LANDMARKS.LEFT_HIP
    ),
    rightShoulder: angleBetween(
      landmarks,
      POSE_LANDMARKS.RIGHT_ELBOW,
      POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.RIGHT_HIP
    ),
    leftHip: angleBetween(
      landmarks,
      POSE_LANDMARKS.LEFT_SHOULDER,
      POSE_LANDMARKS.LEFT_HIP,
      POSE_LANDMARKS.LEFT_KNEE
    ),
    rightHip: angleBetween(
      landmarks,
      POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.RIGHT_HIP,
      POSE_LANDMARKS.RIGHT_KNEE
    ),
  };
}

/* ─── Get status for a single angle ──────────────────────────────────────── */

export function getAngleStatus(key: string, degrees: number): AngleStatus {
  const range = DEFAULT_RANGES[key];
  if (!range) return "optimal";

  if (degrees >= range.optimal.min && degrees <= range.optimal.max) return "optimal";
  if (degrees >= range.marginal.min && degrees <= range.marginal.max) return "marginal";
  return "concerning";
}

/* ─── Get all angles with status ─────────────────────────────────────────── */

const ANGLE_LABELS: Record<string, string> = {
  shoulderSeparation: "Shoulder Separation",
  hipShoulderDifferential: "Hip-Shoulder Diff",
  blockLegKnee: "Block Leg (L Knee)",
  rearLegKnee: "Rear Leg (R Knee)",
  trunkLean: "Trunk Lean",
  leftElbow: "L Elbow",
  rightElbow: "R Elbow",
  leftShoulder: "L Shoulder",
  rightShoulder: "R Shoulder",
  leftHip: "L Hip",
  rightHip: "R Hip",
};

export function getAnglesWithStatus(angles: ThrowAngles): ThrowAngleResult[] {
  return Object.entries(angles).map(([key, degrees]) => ({
    key,
    label: ANGLE_LABELS[key] || key,
    degrees: Math.round(degrees),
    status: getAngleStatus(key, degrees),
  }));
}
