import { z } from "zod";

/**
 * Performance Tests — request schemas.
 *
 * Numeric fields originating in React form state use `.nullable().optional()`
 * per CLAUDE.md §Code Quality Standards Rule 4. The `value` field on attempt
 * create is REQUIRED — missing value means "no attempt yet" not "unset" — and
 * accepts 0 to support bodyweight / no-implement variants in v2.
 */

// ── Sessions ────────────────────────────────────────────────────────────────

export const PerformanceTestSessionCreateSchema = z.object({
  testTypeId: z.string().min(1, "testTypeId is required"),
  /** ISO8601. Defaults to server `new Date()` when omitted. */
  performedAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  conditions: z.string().max(500).nullable().optional(),
});

// ── Attempts ────────────────────────────────────────────────────────────────

export const PerformanceTestAttemptCreateSchema = z.object({
  /** Required. 0 is valid (bodyweight / no-implement). Negative is rejected. */
  value: z.number().min(0, "value must be ≥ 0"),
  notes: z.string().max(500).nullable().optional(),
});

export const PerformanceTestAttemptPatchSchema = z
  .object({
    value: z.number().min(0).nullable().optional(),
    isValid: z.boolean().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (d) => d.value !== undefined || d.isValid !== undefined || d.notes !== undefined,
    "At least one field is required"
  );

// ── Query schemas ───────────────────────────────────────────────────────────

export const PerformanceTestSessionListQuerySchema = z.object({
  testTypeKey: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().min(1).optional(),
});

export const PerformanceTestTrendQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ── Inferred types (for route handlers) ─────────────────────────────────────

export type PerformanceTestSessionCreateInput = z.infer<typeof PerformanceTestSessionCreateSchema>;
export type PerformanceTestAttemptCreateInput = z.infer<typeof PerformanceTestAttemptCreateSchema>;
export type PerformanceTestAttemptPatchInput = z.infer<typeof PerformanceTestAttemptPatchSchema>;
