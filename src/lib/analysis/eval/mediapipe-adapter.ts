import {
  POSE_SCHEMA_VERSION,
  COCO17_KEYPOINTS,
  type PoseOutput,
  type PoseFrame,
  type Keypoint,
} from "@/lib/contracts";

/**
 * Adapts the legacy MediaPipe (33-landmark, normalized [0,1]) output stored in
 * VideoAnalysis.annotations into the COCO-17 PoseOutput contract, so the
 * existing pipeline can be scored as the benchmark baseline row (PRD §9
 * Phase 0: "baseline MediaPipe scored to quantify the problem").
 */

/** MediaPipe BlazePose landmark index → COCO-17 slot. */
const MEDIAPIPE_TO_COCO: Record<(typeof COCO17_KEYPOINTS)[number], number> = {
  nose: 0,
  left_eye: 2,
  right_eye: 5,
  left_ear: 7,
  right_ear: 8,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
};

export interface MediaPipeAnnotationFrame {
  timestamp: number; // seconds
  landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>;
}

export function mediapipeToPoseOutput(args: {
  jobId: string;
  frames: MediaPipeAnnotationFrame[];
  fps: number;
  width: number;
  height: number;
}): PoseOutput {
  const { jobId, frames, fps, width, height } = args;

  const poseFrames: PoseFrame[] = frames.map((frame, i) => {
    const idx = Math.round(frame.timestamp * fps);
    if (!frame.landmarks || frame.landmarks.length < 29) {
      return { idx, t: frame.timestamp, bbox: null, keypoints: null };
    }
    const keypoints: Keypoint[] = COCO17_KEYPOINTS.map((name) => {
      const lm = frame.landmarks[MEDIAPIPE_TO_COCO[name]];
      return {
        x: lm.x * width,
        y: lm.y * height,
        conf: Math.min(1, Math.max(0, lm.visibility ?? 0)),
      };
    });
    const xs = keypoints.map((k) => k.x);
    const ys = keypoints.map((k) => k.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      idx: idx >= 0 ? idx : i,
      t: frame.timestamp,
      bbox: [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY],
      keypoints,
    };
  });

  return {
    schemaVersion: POSE_SCHEMA_VERSION,
    jobId,
    modelId: "mediapipe-blazepose",
    modelVersion: "legacy-baseline",
    fps,
    resolution: { width, height },
    frames: poseFrames,
  };
}
