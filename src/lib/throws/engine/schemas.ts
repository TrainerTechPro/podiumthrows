// ── Zod Schemas for Program Engine Output ────────────────────────────
// Runtime validation of the deterministic engine's GeneratedProgram
// before persisting to the database.

import { z } from "zod";
import type { GeneratedProgram } from "./types";

// ── Prescription Schemas ────────────────────────────────────────────

export const ThrowPrescriptionSchema = z.object({
  implement: z.string().min(1),
  implementKg: z.number().min(0),
  category: z.enum(["CE", "SD", "SP", "GP"]),
  drillType: z.string().min(1),
  sets: z.number().int().min(1),
  repsPerSet: z.number().int().min(1),
  restSeconds: z.number().min(0),
  notes: z.string().optional(),
});

export const StrengthPrescriptionSchema = z.object({
  exerciseId: z.string().min(1),
  exerciseName: z.string().min(1),
  classification: z.enum(["CE", "SD", "SP", "GP"]),
  sets: z.number().int().min(1),
  reps: z.number().int().min(1),
  intensityPercent: z.number().min(0).max(100).optional(),
  loadKg: z.number().min(0).optional(),
  restSeconds: z.number().min(0),
  notes: z.string().optional(),
});

export const WarmupPrescriptionSchema = z.object({
  name: z.string().min(1),
  duration: z.number().min(0).optional(),
  notes: z.string().optional(),
});

// ── Session / Week / Phase Schemas ──────────────────────────────────

export const GeneratedSessionSchema = z.object({
  weekNumber: z.number().int().min(1),
  dayOfWeek: z.number().int().min(1).max(7),
  dayType: z.string().min(1),
  sessionType: z.string().min(1),
  focusLabel: z.string(),
  throws: z.array(ThrowPrescriptionSchema),
  strength: z.array(StrengthPrescriptionSchema),
  warmup: z.array(WarmupPrescriptionSchema),
  totalThrowsTarget: z.number().int().min(0),
  estimatedDuration: z.number().min(0),
});

export const GeneratedWeekSchema = z.object({
  weekNumber: z.number().int().min(1),
  sessions: z.array(GeneratedSessionSchema).min(1),
});

export const ExerciseComplexEntrySchema = z.object({
  name: z.string().min(1),
  classification: z.enum(["CE", "SD", "SP", "GP"]),
  implementKg: z.number().optional(),
  drillType: z.string().optional(),
  correlationR: z.number().optional(),
  setsMin: z.number().int().min(1),
  setsMax: z.number().int().min(1),
  repsMin: z.number().int().min(1),
  repsMax: z.number().int().min(1),
});

export const GeneratedPhaseSchema = z.object({
  phase: z.enum(["ACCUMULATION", "TRANSMUTATION", "REALIZATION", "COMPETITION"]),
  phaseOrder: z.number().int().min(1),
  startWeek: z.number().int().min(1),
  endWeek: z.number().int().min(1),
  durationWeeks: z.number().int().min(1),
  throwsPerWeekTarget: z.number().int().min(0),
  strengthDaysTarget: z.number().int().min(0),

  // Ratios — allow rounding tolerance (sum should be ~100, accept 85–115)
  cePercent: z.number().min(0).max(100),
  sdPercent: z.number().min(0).max(100),
  spPercent: z.number().min(0).max(100),
  gpPercent: z.number().min(0).max(100),

  // Implement distribution
  lightPercent: z.number().min(0).max(100),
  compPercent: z.number().min(0).max(100),
  heavyPercent: z.number().min(0).max(100),

  exerciseComplex: z.array(ExerciseComplexEntrySchema),
  weeks: z.array(GeneratedWeekSchema).min(1),
}).refine(
  (phase) => {
    const classSum = phase.cePercent + phase.sdPercent + phase.spPercent + phase.gpPercent;
    return classSum >= 85 && classSum <= 115;
  },
  { message: "Classification percentages (CE+SD+SP+GP) must sum to approximately 100" },
).refine(
  (phase) => {
    const implSum = phase.lightPercent + phase.compPercent + phase.heavyPercent;
    return implSum >= 85 && implSum <= 115;
  },
  { message: "Implement percentages (light+comp+heavy) must sum to approximately 100" },
);

export const ProgramSummarySchema = z.object({
  totalPhases: z.number().int().min(1),
  totalSessions: z.number().int().min(1),
  estimatedTotalThrows: z.number().int().min(0),
  phaseBreakdown: z.array(
    z.object({
      phase: z.enum(["ACCUMULATION", "TRANSMUTATION", "REALIZATION", "COMPETITION"]),
      weeks: z.number().int().min(1),
      throwsPerWeek: z.number().int().min(0),
    }),
  ),
});

export const GeneratedProgramSchema = z.object({
  phases: z.array(GeneratedPhaseSchema).min(1),
  totalWeeks: z.number().int().min(1),
  summary: ProgramSummarySchema,
});

// ── Validation Function ─────────────────────────────────────────────

export function validateGeneratedProgram(
  program: GeneratedProgram,
): { valid: boolean; errors: string[] } {
  const result = GeneratedProgramSchema.safeParse(program);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );

  return { valid: false, errors };
}
