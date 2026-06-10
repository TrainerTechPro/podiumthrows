import type { SmoothedPose } from "@/lib/contracts";
import { getKp, jointAngle, kpSpeed } from "./geometry";

/**
 * Release-frame detection (F5): wrist-velocity peak + elbow extension.
 * Deterministic; confidence reflects how many criteria agreed.
 *
 * PRD §11 gate: within ±2 frames @60fps on ≥90% of golden-set clips — tuning
 * against real labeled clips happens at the Phase-2 gate; the algorithm and
 * its determinism are fixed here.
 */

export const ELBOW_EXTENSION_DEG = 140;
const ELBOW_WINDOW_FRAMES_AT_60 = 3;

export type Hand = "left" | "right";

export interface ReleaseDetection {
  frame: number;
  confidence: number;
  wristSpeed: number; // px/s at the detected frame
  elbowExtended: boolean;
}

export function detectRelease(
  pose: SmoothedPose,
  hand: Hand = "right"
): ReleaseDetection | null {
  const wrist = hand === "right" ? "right_wrist" : "left_wrist";
  const elbow = hand === "right" ? "right_elbow" : "left_elbow";
  const shoulder = hand === "right" ? "right_shoulder" : "left_shoulder";

  let bestFrame = -1;
  let bestSpeed = -Infinity;
  for (let f = 0; f < pose.frames.length; f++) {
    const speed = kpSpeed(pose, f, wrist);
    if (speed !== null && speed > bestSpeed) {
      bestSpeed = speed;
      bestFrame = f;
    }
  }
  if (bestFrame < 0) return null;

  const window = Math.max(1, Math.round((ELBOW_WINDOW_FRAMES_AT_60 * pose.fps) / 60));
  let elbowExtended = false;
  for (
    let f = Math.max(0, bestFrame - window);
    f <= Math.min(pose.frames.length - 1, bestFrame + window);
    f++
  ) {
    const angle = jointAngle(
      getKp(pose, f, shoulder),
      getKp(pose, f, elbow),
      getKp(pose, f, wrist)
    );
    if (angle !== null && angle >= ELBOW_EXTENSION_DEG) {
      elbowExtended = true;
      break;
    }
  }

  return {
    frame: bestFrame,
    confidence: elbowExtended ? 0.9 : 0.6,
    wristSpeed: bestSpeed,
    elbowExtended,
  };
}
