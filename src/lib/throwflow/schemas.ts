// ── Zod Schemas for AI Video Analysis Response ──────────────────────
// Replaces fragile regex + JSON.parse with structured validation.
// Handles partial/malformed AI responses gracefully.

import { z } from "zod";
import type { AnalysisResult } from "./types";

// ── Individual Field Schemas ────────────────────────────────────────

export const PhaseScoreSchema = z.object({
  name: z.string().min(1),
  score: z.number().min(0).max(10),
  notes: z.string().default(""),
});

export const EnergyLeakSchema = z.object({
  description: z.string().min(1),
  percentImpact: z.number().min(0).max(100),
  frameIndex: z.number().int().min(0),
});

export const ReleaseMetricsSchema = z.object({
  angle: z.number().min(0).max(90).nullable().default(null),
  velocityRating: z
    .enum(["Low", "Moderate", "High", "Elite"])
    .default("Moderate"),
  height: z
    .enum(["Below optimal", "Optimal", "Above optimal"])
    .default("Optimal"),
  theoreticalDistance: z.number().nullable().default(null),
});

export const IssueCardSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
  frameIndex: z.number().int().min(0),
  drill: z.string().default(""),
});

export const DrillRecSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  targetIssue: z.string().default(""),
});

export const AnalysisResponseSchema = z.object({
  phaseScores: z.array(PhaseScoreSchema).default([]),
  energyLeaks: z.array(EnergyLeakSchema).default([]),
  releaseMetrics: ReleaseMetricsSchema.default({
    angle: null,
    velocityRating: "Moderate",
    height: "Optimal",
    theoreticalDistance: null,
  }),
  overallScore: z.number().min(0).max(100).nullable().default(null),
  issueCards: z.array(IssueCardSchema).default([]),
  drillRecs: z.array(DrillRecSchema).default([]),
});

// ── JSON Extraction ─────────────────────────────────────────────────

/**
 * Extract JSON from AI text that may include markdown fences or preamble.
 * Uses a targeted approach: tries the content inside code fences first,
 * then falls back to finding the outermost {...} block.
 */
function extractJson(rawText: string): string | null {
  // Try markdown code fence first: ```json ... ``` or ``` ... ```
  const fenceMatch = rawText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) return fenceMatch[1];

  // Fallback: find the first { and its matching closing }
  const startIdx = rawText.indexOf("{");
  if (startIdx === -1) return null;

  let depth = 0;
  for (let i = startIdx; i < rawText.length; i++) {
    if (rawText[i] === "{") depth++;
    else if (rawText[i] === "}") depth--;
    if (depth === 0) return rawText.slice(startIdx, i + 1);
  }

  return null;
}

// ── Main Parse Function ─────────────────────────────────────────────

type ParseSuccess = {
  success: true;
  data: z.infer<typeof AnalysisResponseSchema>;
};

type ParseFailure = {
  success: false;
  error: string;
  partial?: Partial<AnalysisResult>;
};

/**
 * Parse raw AI response text into a validated AnalysisResult.
 * Handles:
 *   - Markdown code fences around JSON
 *   - Partial/malformed responses (returns what's valid)
 *   - Out-of-range numeric values (clamped by Zod)
 *   - Missing fields (defaults applied by Zod)
 */
export function parseAnalysisResponse(
  rawText: string,
): ParseSuccess | ParseFailure {
  const jsonStr = extractJson(rawText);
  if (!jsonStr) {
    return {
      success: false,
      error: "No JSON found in AI response",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    return {
      success: false,
      error: `JSON parse error: ${e instanceof Error ? e.message : "Unknown"}`,
    };
  }

  const result = AnalysisResponseSchema.safeParse(parsed);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Attempt partial recovery: parse what we can
  const partial: Partial<AnalysisResult> = {};
  const raw = parsed as Record<string, unknown>;

  // Try to recover individual fields
  const phaseResult = z.array(PhaseScoreSchema).safeParse(raw.phaseScores);
  if (phaseResult.success) partial.phaseScores = phaseResult.data;

  const leakResult = z.array(EnergyLeakSchema).safeParse(raw.energyLeaks);
  if (leakResult.success) partial.energyLeaks = leakResult.data;

  const metricsResult = ReleaseMetricsSchema.safeParse(raw.releaseMetrics);
  if (metricsResult.success) partial.releaseMetrics = metricsResult.data;

  if (typeof raw.overallScore === "number") {
    partial.overallScore = Math.max(0, Math.min(100, raw.overallScore));
  }

  const issueResult = z.array(IssueCardSchema).safeParse(raw.issueCards);
  if (issueResult.success) partial.issueCards = issueResult.data;

  const drillResult = z.array(DrillRecSchema).safeParse(raw.drillRecs);
  if (drillResult.success) partial.drillRecs = drillResult.data;

  const errorMessages = result.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");

  return {
    success: false,
    error: `Validation errors: ${errorMessages}`,
    partial: Object.keys(partial).length > 0 ? partial : undefined,
  };
}
