"use client";

import { useRef, useState, useCallback } from "react";

/* ─── Landmark Types ──────────────────────────────────────────────────────── */

export type PoseLandmark = {
  x: number; // 0-1 normalized (fraction of video width)
  y: number; // 0-1 normalized (fraction of video height)
  z: number; // depth
  visibility: number; // 0-1 confidence
};

export type PoseResult = {
  landmarks: PoseLandmark[];
  timestamp: number;
};

/* ─── MediaPipe Pose Landmark Indices ─────────────────────────────────────── */

export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/* ─── Skeleton Connections ────────────────────────────────────────────────── */

export const POSE_CONNECTIONS: [number, number][] = [
  // Upper body
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
  [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
  // Torso
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  // Lower body
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
  // Feet
  [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_HEEL],
  [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_FOOT_INDEX],
  [POSE_LANDMARKS.LEFT_HEEL, POSE_LANDMARKS.LEFT_FOOT_INDEX],
  [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_HEEL],
  [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_FOOT_INDEX],
  [POSE_LANDMARKS.RIGHT_HEEL, POSE_LANDMARKS.RIGHT_FOOT_INDEX],
  // Wrist details
  [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.LEFT_INDEX],
  [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.LEFT_THUMB],
  [POSE_LANDMARKS.RIGHT_WRIST, POSE_LANDMARKS.RIGHT_INDEX],
  [POSE_LANDMARKS.RIGHT_WRIST, POSE_LANDMARKS.RIGHT_THUMB],
];

/* ─── Joint Angle Presets (Throws Analysis) ───────────────────────────────── */

export type JointAngle = {
  a: number; // landmark index — arm 1
  b: number; // landmark index — vertex
  c: number; // landmark index — arm 2
  label: string;
};

export const THROWS_ANGLES: Record<string, JointAngle> = {
  leftElbow: {
    a: POSE_LANDMARKS.LEFT_SHOULDER,
    b: POSE_LANDMARKS.LEFT_ELBOW,
    c: POSE_LANDMARKS.LEFT_WRIST,
    label: "L Elbow",
  },
  rightElbow: {
    a: POSE_LANDMARKS.RIGHT_SHOULDER,
    b: POSE_LANDMARKS.RIGHT_ELBOW,
    c: POSE_LANDMARKS.RIGHT_WRIST,
    label: "R Elbow",
  },
  leftKnee: {
    a: POSE_LANDMARKS.LEFT_HIP,
    b: POSE_LANDMARKS.LEFT_KNEE,
    c: POSE_LANDMARKS.LEFT_ANKLE,
    label: "L Knee",
  },
  rightKnee: {
    a: POSE_LANDMARKS.RIGHT_HIP,
    b: POSE_LANDMARKS.RIGHT_KNEE,
    c: POSE_LANDMARKS.RIGHT_ANKLE,
    label: "R Knee",
  },
  leftShoulder: {
    a: POSE_LANDMARKS.LEFT_ELBOW,
    b: POSE_LANDMARKS.LEFT_SHOULDER,
    c: POSE_LANDMARKS.LEFT_HIP,
    label: "L Shoulder",
  },
  rightShoulder: {
    a: POSE_LANDMARKS.RIGHT_ELBOW,
    b: POSE_LANDMARKS.RIGHT_SHOULDER,
    c: POSE_LANDMARKS.RIGHT_HIP,
    label: "R Shoulder",
  },
  leftHip: {
    a: POSE_LANDMARKS.LEFT_SHOULDER,
    b: POSE_LANDMARKS.LEFT_HIP,
    c: POSE_LANDMARKS.LEFT_KNEE,
    label: "L Hip",
  },
  rightHip: {
    a: POSE_LANDMARKS.RIGHT_SHOULDER,
    b: POSE_LANDMARKS.RIGHT_HIP,
    c: POSE_LANDMARKS.RIGHT_KNEE,
    label: "R Hip",
  },
};

/* ─── Angle Calculation ───────────────────────────────────────────────────── */

/** θ = |arctan2(yc-yb, xc-xb) - arctan2(ya-yb, xa-xb)| × 180/π */
export function calculateAngle(
  a: PoseLandmark,
  b: PoseLandmark, // vertex
  c: PoseLandmark
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let degrees = Math.abs((radians * 180) / Math.PI);
  if (degrees > 180) degrees = 360 - degrees;
  return degrees;
}

/* ─── Hook Return Type ────────────────────────────────────────────────────── */

export type UsePoseDetectionReturn = {
  /** Whether the model is loading */
  loading: boolean;
  /** Whether pose detection is currently active */
  active: boolean;
  /** Last detected pose landmarks (or null if none) */
  pose: PoseResult | null;
  /** Error message if initialization failed */
  error: string | null;
  /** Initialize the model (lazy) */
  initialize: () => Promise<void>;
  /** Detect pose on the current video frame */
  detectFrame: (video: HTMLVideoElement) => Promise<PoseResult | null>;
  /** Toggle detection on/off */
  toggle: () => void;
  /** Clear current detection */
  clear: () => void;
};

/* ─── Hook ────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PoseLandmarkerClass: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FilesetResolverClass: any = null;

export function usePoseDetection(): UsePoseDetectionReturn {
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);
  const [pose, setPose] = useState<PoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);
  const initializedRef = useRef(false);

  /* ── Lazy initialization ─────────────────────────────────────────── */

  const initialize = useCallback(async () => {
    if (initializedRef.current && landmarkerRef.current) return;
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      // Dynamic import to avoid bundling the large WASM module at build time
      if (!PoseLandmarkerClass || !FilesetResolverClass) {
        const vision = await import("@mediapipe/tasks-vision");
        PoseLandmarkerClass = vision.PoseLandmarker;
        FilesetResolverClass = vision.FilesetResolver;
      }

      const fileset = await FilesetResolverClass.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
      );

      landmarkerRef.current = await PoseLandmarkerClass.createFromOptions(
        fileset,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
            delegate: "GPU",
          },
          runningMode: "IMAGE",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }
      );

      initializedRef.current = true;
    } catch (err) {
      console.error("Failed to initialize MediaPipe Pose:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load pose detection model"
      );
    } finally {
      setLoading(false);
    }
  }, [loading]);

  /* ── Detect pose on a single frame ─────────────────────────────── */

  const detectFrame = useCallback(
    async (video: HTMLVideoElement): Promise<PoseResult | null> => {
      if (!landmarkerRef.current) {
        await initialize();
      }
      if (!landmarkerRef.current) return null;

      try {
        const result = landmarkerRef.current.detect(video);

        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks: PoseLandmark[] = result.landmarks[0].map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (lm: any) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z ?? 0,
              visibility: lm.visibility ?? 1,
            })
          );

          const poseResult: PoseResult = {
            landmarks,
            timestamp: video.currentTime,
          };

          setPose(poseResult);
          return poseResult;
        }

        setPose(null);
        return null;
      } catch (err) {
        console.error("Pose detection failed:", err);
        return null;
      }
    },
    [initialize]
  );

  /* ── Toggle ──────────────────────────────────────────────────────── */

  const toggle = useCallback(() => {
    setActive((prev) => {
      if (prev) {
        setPose(null);
        return false;
      }
      return true;
    });
  }, []);

  /* ── Clear ──────────────────────────────────────────────────────── */

  const clear = useCallback(() => {
    setPose(null);
    setActive(false);
  }, []);

  return {
    loading,
    active,
    pose,
    error,
    initialize,
    detectFrame,
    toggle,
    clear,
  };
}
