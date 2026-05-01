/**
 * Catalog-aware Zod schemas for the new /api/throws mutation routes.
 *
 * Distinct from src/lib/api-schemas.ts (which contains the legacy schemas
 * still used by athlete/quick-log, athlete/sessions/*, coach/throws, and
 * the existing /api/throws/prs check). Phase D will fold those over.
 *
 * Numeric fields follow CLAUDE.md §3 — distinguish empty from zero. Nullable
 * inputs use `.nullable().optional()` per §4 so React form state's `null`
 * for-unset doesn't silently 400.
 */

import { z } from "zod";
import type { ImplementType, EventType } from "@prisma/client";

const WireLengthEnum = z.enum(["FULL", "THREE_QUARTER", "HALF"]);

/** Map catalog throwType (SHOT) to ThrowLog.event (SHOT_PUT). */
export function eventFromImplementType(t: ImplementType): EventType {
  return t === "SHOT" ? "SHOT_PUT" : t;
}

const ThrowRoundEnum = z.enum(["PRELIM", "FINALS"]);

const FoulTypeEnum = z.enum(["RING", "SECTOR"]);

/**
 * POST /api/throws — create a single throw via catalog identity.
 *
 * implementId is the source of truth. distance can be null (Quick-Log
 * tap-to-count). Server derives implementWeight + Unit + Original from the
 * catalog row to keep the legacy column populated during migration.
 */
export const ThrowCreateSchema = z.object({
  athleteId: z.string().min(1, "athleteId is required"),
  implementId: z.string().min(1, "implementId is required"),
  distance: z.number().nullable().optional(),
  performedAt: z.string().datetime().nullable().optional(),
  isCompetition: z.boolean().optional().default(false),
  rpe: z.number().min(1).max(10).nullable().optional(),
  attemptNumber: z.number().int().positive().nullable().optional(),
  wireLength: WireLengthEnum.nullable().optional(),
  notes: z.string().nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
  // Competition linkage — all nullable for practice rows.
  competitionId: z.string().nullable().optional(),
  round: ThrowRoundEnum.nullable().optional(),
  attemptInRound: z.number().int().positive().nullable().optional(),
  isFoul: z.boolean().optional().default(false),
  foulType: FoulTypeEnum.nullable().optional(),
  isPass: z.boolean().optional().default(false),
  // Optional session linkage.
  sessionId: z.string().nullable().optional(),
});

export type ThrowCreateInput = z.infer<typeof ThrowCreateSchema>;

/**
 * PATCH /api/throws/:id — edit. All fields optional; only provided ones are
 * updated. Changing implementId triggers PR recompute on BOTH old + new.
 */
export const ThrowUpdateSchema = z
  .object({
    implementId: z.string().min(1).nullable().optional(),
    distance: z.number().nullable().optional(),
    performedAt: z.string().datetime().nullable().optional(),
    isCompetition: z.boolean().optional(),
    rpe: z.number().min(1).max(10).nullable().optional(),
    attemptNumber: z.number().int().positive().nullable().optional(),
    wireLength: WireLengthEnum.nullable().optional(),
    notes: z.string().nullable().optional(),
    videoUrl: z.string().url().nullable().optional(),
    isFoul: z.boolean().optional(),
    foulType: FoulTypeEnum.nullable().optional(),
    isPass: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

export type ThrowUpdateInput = z.infer<typeof ThrowUpdateSchema>;

/**
 * POST /api/throws/bulk-reassign — relabel many throws to a different
 * implement at once (history page bulk select).
 */
export const ThrowBulkReassignSchema = z.object({
  throwIds: z.array(z.string().min(1)).min(1, "At least one throwId required"),
  newImplementId: z.string().min(1, "newImplementId is required"),
});

export type ThrowBulkReassignInput = z.infer<typeof ThrowBulkReassignSchema>;

/**
 * POST /api/throws/relabel-by-weight — Fix Old Throws helper (Phase C).
 * Schema declared here so Phase C route can import it without touching this
 * file again.
 */
export const ThrowRelabelByWeightSchema = z.object({
  athleteId: z.string().min(1, "athleteId is required"),
  fromWeightKg: z.number().positive("fromWeightKg must be positive"),
  fromTolerance: z.number().nonnegative().optional().default(0.05),
  toImplementId: z.string().min(1, "toImplementId is required"),
});

export type ThrowRelabelByWeightInput = z.infer<typeof ThrowRelabelByWeightSchema>;
