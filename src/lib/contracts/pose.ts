import { z } from "zod";

/**
 * Pose service output contract (PRD F3, verbatim):
 * frames[] { idx, t, bbox, keypoints[17] { x, y, conf } } in COCO-17 schema,
 * plus model id/version, fps, resolution.
 */

export const POSE_SCHEMA_VERSION = "1.0" as const;

export const COCO17_KEYPOINTS = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
] as const;

export type Coco17KeypointName = (typeof COCO17_KEYPOINTS)[number];

export const KeypointSchema = z.object({
  x: z.number(),
  y: z.number(),
  conf: z.number().min(0).max(1),
});
export type Keypoint = z.infer<typeof KeypointSchema>;

/** bbox is [x, y, w, h] in pixels; null when no (unambiguous) person detected. */
export const PoseFrameSchema = z.object({
  idx: z.number().int().nonnegative(),
  t: z.number().nonnegative(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
  keypoints: z.array(KeypointSchema).length(COCO17_KEYPOINTS.length).nullable(),
});
export type PoseFrame = z.infer<typeof PoseFrameSchema>;

export const PoseOutputSchema = z.object({
  schemaVersion: z.literal(POSE_SCHEMA_VERSION),
  jobId: z.string().min(1),
  modelId: z.string().min(1),
  modelVersion: z.string().min(1),
  fps: z.number().positive(),
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  frames: z.array(PoseFrameSchema),
});
export type PoseOutput = z.infer<typeof PoseOutputSchema>;

/** Modal → /api/analysis/webhooks/pose callback body (HMAC-signed). */
export const PoseWebhookPayloadSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(["pose_complete", "failed"]),
  /** R2 key of the PoseOutput JSON; present iff status === pose_complete. */
  rawPath: z.string().min(1).nullable().optional(),
  modelId: z.string().nullable().optional(),
  modelVersion: z.string().nullable().optional(),
  fpsTrue: z.number().positive().nullable().optional(),
  meanDetectionConf: z.number().min(0).max(1).nullable().optional(),
  error: z
    .object({ code: z.string(), message: z.string() })
    .nullable()
    .optional(),
  timings: z.record(z.string(), z.number()).nullable().optional(),
});
export type PoseWebhookPayload = z.infer<typeof PoseWebhookPayloadSchema>;
