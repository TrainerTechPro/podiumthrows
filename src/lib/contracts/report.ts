import { z } from "zod";
import { MetricValueSchema, AnalysisEventSchema, ConfidenceGradeSchema } from "./metrics";
import { FaultResultSchema } from "./faults";

/**
 * ReportModel (PRD F9, decisions.md D10): the single source of every string
 * painted into the in-app report and the PDF. The traceability gate — every
 * displayed number exists in analysis_results.metrics — is enforced as a
 * deterministic test over this model, so nothing can render an untraceable
 * number without failing the build.
 */

export const RubricItemSchema = z.object({
  metricKey: z.string().min(1),
  label: z.string().min(1),
  value: MetricValueSchema,
  weight: z.number().min(0).max(1),
});

export const PhaseScoreSchema = z.object({
  phase: z.string().min(1),
  /** 0–10, weighted measured sub-metrics per the published rubric. */
  score: z.number().min(0).max(10).nullable(),
  items: z.array(RubricItemSchema),
});
export type PhaseScore = z.infer<typeof PhaseScoreSchema>;

export const FaultCardSchema = z.object({
  fault: FaultResultSchema,
  /** e.g. "Separation: 18° (target 35–45°)" — built only from fault fields. */
  displayValue: z.string().min(1),
  displayTarget: z.string().min(1),
  thumbnailPath: z.string().nullable().optional(),
});
export type FaultCard = z.infer<typeof FaultCardSchema>;

export const ReportModelSchema = z.object({
  header: z.object({
    event: AnalysisEventSchema,
    athleteName: z.string().min(1),
    date: z.string().min(1), // ISO date
    calibrated: z.boolean(),
    /** Clip-level confidence badge; null/absent for pre-grading results. */
    clipConfidence: ConfidenceGradeSchema.nullable().optional(),
  }),
  phaseScores: z.array(PhaseScoreSchema),
  faultCards: z.array(FaultCardSchema),
  drills: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      rationale: z.string().nullable().optional(),
    })
  ),
  coachSummary: z.string(),
  /** "How these numbers are measured" page content. */
  methodology: z.array(z.string()),
  watermark: z.boolean(),
  rubricVersion: z.string().min(1),
  rulesVersion: z.string().min(1),
});
export type ReportModel = z.infer<typeof ReportModelSchema>;
