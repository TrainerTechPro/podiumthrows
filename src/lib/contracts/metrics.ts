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

/** value === null ⇒ not measurable on this clip (e.g. velocity uncalibrated). */
export const MetricValueSchema = z.object({
  value: z.number().finite().nullable(),
  unit: MetricUnitSchema,
  confidence: z.number().min(0).max(1),
  frameRefs: z.array(z.number().int().nonnegative()),
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

export const MetricsOutputSchema = z.object({
  schemaVersion: z.literal(METRICS_SCHEMA_VERSION),
  event: AnalysisEventSchema,
  definitionsVersion: z.string().min(1),
  calibrated: z.boolean(),
  metrics: z.record(z.string(), MetricValueSchema),
  phaseBoundaries: PhaseBoundariesSchema,
  quality: QualitySummarySchema,
});
export type MetricsOutput = z.infer<typeof MetricsOutputSchema>;
