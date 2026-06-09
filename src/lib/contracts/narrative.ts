import { z } from "zod";
import { MetricValueSchema, AnalysisEventSchema } from "./metrics";
import { FaultResultSchema } from "./faults";

/**
 * Narrative layer contracts (PRD F7) — the only LLM stage.
 * The model may reference only numbers present in the input JSON; drill
 * selection is restricted to the resolved drill list passed in (never invents
 * drills). Enforced by narrative/numeral-validator.ts.
 */

export const NarrativeDrillOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()),
});
export type NarrativeDrillOption = z.infer<typeof NarrativeDrillOptionSchema>;

export const NarrativeInputSchema = z.object({
  event: AnalysisEventSchema,
  athleteContext: z.object({
    level: z.string().nullable().optional(),
    recentFaultIds: z.array(z.string()).default([]),
  }),
  metrics: z.record(z.string(), MetricValueSchema),
  faults: z.array(FaultResultSchema),
  /** The ONLY drills the model may select from (D8). */
  drillOptions: z.array(NarrativeDrillOptionSchema),
});
export type NarrativeInput = z.infer<typeof NarrativeInputSchema>;

export const NarrativeOutputSchema = z.object({
  /** ≤ 120 words per PRD; word count enforced post-parse, not by zod. */
  coachSummary: z.string().min(1),
  phaseCommentary: z.array(
    z.object({
      phase: z.string().min(1),
      comment: z.string().min(1),
    })
  ),
  drillSelections: z.array(
    z.object({
      drillId: z.string().min(1),
      rationale: z.string().min(1),
    })
  ),
});
export type NarrativeOutput = z.infer<typeof NarrativeOutputSchema>;

/** What lands in analysis_results.narrative, with provenance of how it was produced. */
export const StoredNarrativeSchema = z.object({
  output: NarrativeOutputSchema,
  source: z.enum(["claude", "template_fallback"]),
  model: z.string().nullable().optional(),
  validatorRetries: z.number().int().nonnegative(),
});
export type StoredNarrative = z.infer<typeof StoredNarrativeSchema>;
