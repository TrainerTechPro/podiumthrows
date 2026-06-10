import { z } from "zod";

/**
 * Fault detection contracts (PRD F6).
 * Output per fault, verbatim from the PRD:
 * { ruleId, severity, measuredValue, targetRange, evidenceFrames[], drillTags[] }.
 * No "% energy lost" figures anywhere — unmeasurable, banned.
 */

export const FaultSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type FaultSeverity = z.infer<typeof FaultSeveritySchema>;

/**
 * A rule the engine could not evaluate honestly: the driving metric exists
 * but its confidence sits below the rule's minConfidence. Surfaced as
 * "not assessed (low confidence)" instead of silently absent, so a coach on
 * quick-analysis footage can tell "clean" from "couldn't check".
 */
export const NotAssessedFaultSchema = z.object({
  ruleId: z.string().min(1),
  faultName: z.string().min(1),
  metricKey: z.string().min(1),
  reason: z.literal("low_confidence"),
  confidence: z.number().min(0).max(1),
  minConfidence: z.number().min(0).max(1),
});
export type NotAssessedFault = z.infer<typeof NotAssessedFaultSchema>;

export const FaultResultSchema = z.object({
  ruleId: z.string().min(1),
  severity: FaultSeveritySchema,
  measuredValue: z.number().finite(),
  targetRange: z.tuple([z.number(), z.number()]),
  evidenceFrames: z.array(z.number().int().nonnegative()),
  drillTags: z.array(z.string()),
  // Display superset (UI renders "Separation: 18° (target 35–45°)")
  faultName: z.string().min(1),
  metricKey: z.string().min(1),
  unit: z.string().min(1),
});
export type FaultResult = z.infer<typeof FaultResultSchema>;

/**
 * What analysis_results.faults holds. Legacy rows are a bare FaultResult[];
 * rows written after quick-analysis shipped carry the envelope with
 * notAssessed alongside. Read through normalizeStoredFaults.
 */
export const StoredFaultsSchema = z.union([
  z.array(FaultResultSchema),
  z.object({
    fired: z.array(FaultResultSchema),
    notAssessed: z.array(NotAssessedFaultSchema),
  }),
]);
export type StoredFaults = z.infer<typeof StoredFaultsSchema>;

export function normalizeStoredFaults(stored: unknown): {
  fired: FaultResult[];
  notAssessed: NotAssessedFault[];
} {
  if (Array.isArray(stored)) return { fired: stored as FaultResult[], notAssessed: [] };
  if (stored && typeof stored === "object" && "fired" in stored) {
    const s = stored as { fired: FaultResult[]; notAssessed?: NotAssessedFault[] };
    return { fired: s.fired ?? [], notAssessed: s.notAssessed ?? [] };
  }
  return { fired: [], notAssessed: [] };
}

/**
 * Versioned rules config (faults/rules/{event}.json) — rules in config, not
 * code; thresholds coach-editable without redeploy. severityBands map the
 * absolute deviation from the nearest targetRange edge to a severity.
 */
export const FaultRuleSchema = z.object({
  ruleId: z.string().min(1),
  faultName: z.string().min(1),
  /** Key into MetricsOutput.metrics. */
  metricKey: z.string().min(1),
  /** "below" fires when value < targetRange[0]; "above" when > [1]; "outside" either. */
  comparator: z.enum(["below", "above", "outside"]),
  targetRange: z.tuple([z.number(), z.number()]),
  unit: z.string().min(1),
  severityBands: z
    .array(
      z.object({
        deviationGte: z.number().nonnegative(),
        severity: FaultSeveritySchema,
      })
    )
    .min(1),
  /** Minimum metric confidence to evaluate the rule at all (no false accusations). */
  minConfidence: z.number().min(0).max(1).default(0.5),
  drillTags: z.array(z.string()),
  coachTunable: z.boolean().default(true),
});
export type FaultRule = z.infer<typeof FaultRuleSchema>;

/** drillTag → existing-Drill lookup spec (decisions.md D8). */
export const DrillTagMapSchema = z.record(
  z.string(),
  z.object({
    category: z.string().nullable().optional(),
    keywords: z.array(z.string()).default([]),
  })
);

export const FaultRulesFileSchema = z.object({
  version: z.string().min(1),
  event: z.enum(["SHOT_PUT", "DISCUS", "HAMMER", "JAVELIN"]),
  rules: z.array(FaultRuleSchema),
  drillTagMap: DrillTagMapSchema,
});
export type FaultRulesFile = z.infer<typeof FaultRulesFileSchema>;
