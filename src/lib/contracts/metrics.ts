import { z } from "zod";

/**
 * Metrics engine output contract (PRD F5, verbatim):
 * every metric output is { value, unit, confidence, frameRefs[] }.
 * No metric without provenance.
 */

export const METRICS_SCHEMA_VERSION = "1.0" as const;

export const AnalysisEventSchema = z.enum([
  "SHOT_PUT",
  "DISCUS",
  "HAMMER",
  "JAVELIN",
]);
export type AnalysisEvent = z.infer<typeof AnalysisEventSchema>;

export const MetricUnitSchema = z.enum([
  "deg",
  "m",
  "m/s",
  "s",
  "frame",
  "ratio",
  "count",
  "px",
]);
export type MetricUnit = z.infer<typeof MetricUnitSchema>;

/**
 * Graded confidence (quick-analysis mode): HIGH/MEDIUM/LOW derived from the
 * numeric confidence plus clip conditions, with view-sensitive metrics capped
 * at MEDIUM when uncalibrated. Computed in lib/analysis/confidence.ts.
 */
export const ConfidenceGradeSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type ConfidenceGrade = z.infer<typeof ConfidenceGradeSchema>;

/** value === null ⇒ not measurable on this clip (e.g. velocity uncalibrated). */
export const MetricValueSchema = z.object({
  value: z.number().finite().nullable(),
  unit: MetricUnitSchema,
  confidence: z.number().min(0).max(1),
  frameRefs: z.array(z.number().int().nonnegative()),
  /** Optional for results stored before graded confidence shipped. */
  confidenceGrade: ConfidenceGradeSchema.optional(),
});
export type MetricValue = z.infer<typeof MetricValueSchema>;

/** Rotational shot phases; glide variant reuses drive for the glide itself. */
export const SHOTPUT_PHASES = [
  "entry",
  "drive",
  "power_position",
  "delivery",
  "recovery",
] as const;
export type ShotPutPhase = (typeof SHOTPUT_PHASES)[number];

export const PhaseBoundarySchema = z.object({
  phase: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
});
export type PhaseBoundary = z.infer<typeof PhaseBoundarySchema>;
export const PhaseBoundariesSchema = z.array(PhaseBoundarySchema);

export const QualitySummarySchema = z.object({
  meanQuality: z.number().min(0).max(1),
  /** true ⇒ job parks at LOW_CONFIDENCE; never analyzed with false confidence (F4). */
  lowConfidence: z.boolean(),
});

/** Per-clip confidence grade with the raw signals it was derived from. */
export const ClipConfidenceSchema = z.object({
  grade: ConfidenceGradeSchema,
  meanQuality: z.number().min(0).max(1),
  fps: z.number().positive(),
  /** Fraction of frames whose pose quality fell below the degraded threshold. */
  degradedFrameFraction: z.number().min(0).max(1),
});
export type ClipConfidence = z.infer<typeof ClipConfidenceSchema>;

export const MetricsOutputSchema = z.object({
  schemaVersion: z.literal(METRICS_SCHEMA_VERSION),
  event: AnalysisEventSchema,
  definitionsVersion: z.string().min(1),
  calibrated: z.boolean(),
  metrics: z.record(z.string(), MetricValueSchema),
  phaseBoundaries: PhaseBoundariesSchema,
  quality: QualitySummarySchema,
  /** Optional for results stored before graded confidence shipped. */
  clipConfidence: ClipConfidenceSchema.optional(),
});
export type MetricsOutput = z.infer<typeof MetricsOutputSchema>;
