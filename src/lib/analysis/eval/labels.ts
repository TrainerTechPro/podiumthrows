import { z } from "zod";
import { COCO17_KEYPOINTS } from "@/lib/contracts";
import { AnalysisEventSchema } from "@/lib/contracts";

/**
 * Golden-set ground-truth labels (golden_set_clips.labels jsonb).
 * Produced by scripts/eval/label-clips.ts; consumed by the benchmark runner.
 */

export const GT_SCHEMA_VERSION = "1.0" as const;

export const GtKeypointSchema = z.object({
  x: z.number(),
  y: z.number(),
  /** false ⇒ occluded/unlabelable at this instant; excluded from PCK. */
  visible: z.boolean(),
});

const keypointNameSchema = z.enum(
  COCO17_KEYPOINTS as unknown as [string, ...string[]]
);

/** Keypoint GT at one critical instant (power position, release, …).
 *  partialRecord: labeling a subset of the 17 joints is the normal case. */
export const GtFrameSchema = z.object({
  frame: z.number().int().nonnegative(),
  keypoints: z.partialRecord(keypointNameSchema, GtKeypointSchema),
});
export type GtFrame = z.infer<typeof GtFrameSchema>;

export const GoldenLabelsSchema = z.object({
  schemaVersion: z.literal(GT_SCHEMA_VERSION),
  event: AnalysisEventSchema,
  fps: z.number().positive(),
  totalFrames: z.number().int().positive(),
  releaseFrame: z.number().int().nonnegative().nullable(),
  phaseBoundaries: z.array(
    z.object({
      phase: z.string().min(1),
      startFrame: z.number().int().nonnegative(),
      endFrame: z.number().int().nonnegative(),
    })
  ),
  keypointGT: z.array(GtFrameSchema),
  notes: z.string().nullable().optional(),
});
export type GoldenLabels = z.infer<typeof GoldenLabelsSchema>;
