// src/lib/insights/types.ts
/**
 * Shared types for the insight layer.
 * Analyzers return StructuredInsight[]; templates add {title, body, detail}.
 */

export type ConfidenceBand = "WEAK" | "MEDIUM" | "STRONG";

export type InsightCategory = "TRAINING_PATTERN" | "LIFT_THROW" | "READINESS_COMPETITION";

export type InsightEvent = "SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN";

export type StructuredInsight<TEvidence = unknown> = {
  category: InsightCategory;
  metric: string; // e.g. "exerciseUsage.shot_put.8kg_shot"
  event: InsightEvent | null; // null when event-agnostic
  confidenceBand: ConfidenceBand;
  dataPoints: number;
  coefficient: number | null; // Pearson r or regression slope
  effectSize: number | null;
  effectUnit: string | null;
  evidence: TEvidence; // analyzer-specific shape, JSON-serializable
  renderInputs: Record<string, string | number>; // slot values for the template
};

export interface Analyzer<TEvidence = unknown> {
  readonly category: InsightCategory;
  analyze(athleteId: string): Promise<StructuredInsight<TEvidence>[]>;
}

export type RenderedInsight<TEvidence = unknown> = StructuredInsight<TEvidence> & {
  title: string;
  body: string;
  detail: string | null;
};
