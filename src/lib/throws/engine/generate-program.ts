// ── Program Generator (Orchestrator) ────────────────────────────────
// Main entry point for the training engine. Consumes ProgramConfig and
// generates the full macrocycle: phase sequence, exercise complexes,
// week-by-week sessions, throws + strength prescriptions.

import { PHASE_CONFIGS } from "../constants";
import type { TrainingPhase } from "../constants";
import { generatePhase } from "./generate-phase";
import type {
  ProgramConfig,
  GeneratedProgram,
  GeneratedPhase,
  ProgramSummary,
} from "./types";

// ── Configuration ───────────────────────────────────────────────────

/** Phase sequence for the standard Bondarchuk macrocycle */
const _PHASE_SEQUENCE: TrainingPhase[] = [
  "ACCUMULATION",
  "TRANSMUTATION",
  "REALIZATION",
  "COMPETITION",
];

/**
 * Phase duration scaling by adaptation group.
 * Group 1 (fast): shorter phases, Group 3 (slow): longer phases.
 */
const ADAPTATION_PHASE_SCALE: Record<number, number> = {
  1: 0.80, // Fast adapters cycle through phases quicker
  2: 1.00, // Baseline
  3: 1.20, // Slow adapters need longer phases
};

// ── Main Function ───────────────────────────────────────────────────

/**
 * Generate a complete training program (macrocycle).
 *
 * Algorithm:
 * 1. Calculate total available weeks from start → target date
 * 2. Distribute weeks across phases based on adaptation profile
 * 3. If enough weeks, repeat ACCUMULATION → TRANSMUTATION cycles
 * 4. Always end with REALIZATION → COMPETITION before target date
 * 5. Generate each phase with its exercise complex, volume, sessions
 */
export function generateProgram(config: ProgramConfig): GeneratedProgram {
  // Calculate total available weeks
  const startDate = new Date(config.startDate);
  const targetDate = new Date(config.targetDate);
  const totalDays = Math.round(
    (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const totalWeeks = Math.max(4, Math.floor(totalDays / 7));

  // Plan phase durations
  const phaseplan = planPhases(totalWeeks, config.adaptationGroup);

  // Generate each phase
  const phases: GeneratedPhase[] = [];
  let currentWeek = 1;

  for (const planned of phaseplan) {
    const phase = generatePhase({
      phase: planned.phase,
      phaseOrder: planned.order,
      startWeek: currentWeek,
      durationWeeks: planned.weeks,
      programConfig: config,
    });
    phases.push(phase);
    currentWeek += planned.weeks;
  }

  // Build summary
  const summary = buildSummary(phases);

  return {
    phases,
    totalWeeks: currentWeek - 1,
    summary,
  };
}

// ── Phase Planning ──────────────────────────────────────────────────

interface PlannedPhase {
  phase: TrainingPhase;
  weeks: number;
  order: number;
}

/**
 * Plan the phase sequence and durations for the macrocycle.
 *
 * Strategy:
 * - Minimum program: 4 weeks (ACCUM 2 + REAL 1 + COMP 1)
 * - Short programs (4-8 wk): Single pass through all 4 phases
 * - Medium programs (8-16 wk): Full cycle with adequate phase lengths
 * - Long programs (16+ wk): Repeat ACCUM→TRANS cycles before final peak
 */
function planPhases(totalWeeks: number, adaptationGroup: number): PlannedPhase[] {
  const scale = ADAPTATION_PHASE_SCALE[adaptationGroup] ?? 1.0;

  // Get base durations from PHASE_CONFIGS (use midpoints, scaled)
  const baseDurations: Record<TrainingPhase, number> = {
    ACCUMULATION: 0,
    TRANSMUTATION: 0,
    REALIZATION: 0,
    COMPETITION: 0,
  };

  for (const pc of PHASE_CONFIGS) {
    const mid = (pc.durationWeeksMin + pc.durationWeeksMax) / 2;
    baseDurations[pc.phase] = Math.round(mid * scale);
  }

  // Ensure minimums
  baseDurations.REALIZATION = Math.max(2, baseDurations.REALIZATION);
  baseDurations.COMPETITION = Math.max(1, baseDurations.COMPETITION);

  // Reserve weeks for final peak (REALIZATION + COMPETITION)
  const peakWeeks = baseDurations.REALIZATION + baseDurations.COMPETITION;
  const buildWeeks = totalWeeks - peakWeeks;

  const plan: PlannedPhase[] = [];
  let order = 1;

  if (buildWeeks <= 0) {
    // Very short program — minimal ACCUMULATION + peak
    const accumWeeks = Math.max(2, totalWeeks - 2);
    plan.push({ phase: "ACCUMULATION", weeks: accumWeeks, order: order++ });
    const remaining = totalWeeks - accumWeeks;
    if (remaining >= 2) {
      plan.push({ phase: "REALIZATION", weeks: 1, order: order++ });
      plan.push({ phase: "COMPETITION", weeks: remaining - 1, order: order++ });
    } else if (remaining > 0) {
      plan.push({ phase: "COMPETITION", weeks: remaining, order: order++ });
    }
    return plan;
  }

  if (buildWeeks <= 8) {
    // Single pass: ACCUMULATION → TRANSMUTATION → REALIZATION → COMPETITION
    const accumWeeks = Math.max(
      baseDurations.ACCUMULATION,
      Math.round(buildWeeks * 0.55),
    );
    const transWeeks = Math.max(2, buildWeeks - accumWeeks);

    plan.push({ phase: "ACCUMULATION", weeks: accumWeeks, order: order++ });
    plan.push({ phase: "TRANSMUTATION", weeks: transWeeks, order: order++ });
  } else {
    // Multi-cycle: repeated ACCUMULATION → TRANSMUTATION blocks
    let remainingBuild = buildWeeks;
    let _cycleNum = 0;

    while (remainingBuild > 0) {
      _cycleNum++;
      const isLastCycle =
        remainingBuild <=
        baseDurations.ACCUMULATION + baseDurations.TRANSMUTATION;

      if (isLastCycle) {
        // Last cycle — use remaining weeks
        const accumWeeks = Math.max(
          2,
          Math.round(remainingBuild * 0.55),
        );
        const transWeeks = Math.max(2, remainingBuild - accumWeeks);

        plan.push({ phase: "ACCUMULATION", weeks: accumWeeks, order: order++ });
        plan.push({ phase: "TRANSMUTATION", weeks: transWeeks, order: order++ });
        remainingBuild = 0;
      } else {
        plan.push({
          phase: "ACCUMULATION",
          weeks: baseDurations.ACCUMULATION,
          order: order++,
        });
        plan.push({
          phase: "TRANSMUTATION",
          weeks: baseDurations.TRANSMUTATION,
          order: order++,
        });
        remainingBuild -=
          baseDurations.ACCUMULATION + baseDurations.TRANSMUTATION;
      }
    }
  }

  // Always finish with REALIZATION → COMPETITION
  plan.push({
    phase: "REALIZATION",
    weeks: baseDurations.REALIZATION,
    order: order++,
  });
  plan.push({
    phase: "COMPETITION",
    weeks: baseDurations.COMPETITION,
    order: order++,
  });

  return plan;
}

// ── Summary Builder ─────────────────────────────────────────────────

function buildSummary(phases: GeneratedPhase[]): ProgramSummary {
  let totalSessions = 0;
  let estimatedTotalThrows = 0;

  const phaseBreakdown = phases.map((p) => {
    const weekSessions = p.weeks.reduce(
      (sum, w) => sum + w.sessions.length,
      0,
    );
    totalSessions += weekSessions;

    const weekThrows = p.weeks.reduce(
      (sum, w) =>
        sum +
        w.sessions.reduce((s, sess) => s + sess.totalThrowsTarget, 0),
      0,
    );
    estimatedTotalThrows += weekThrows;

    return {
      phase: p.phase,
      weeks: p.durationWeeks,
      throwsPerWeek: p.throwsPerWeekTarget,
    };
  });

  return {
    totalPhases: phases.length,
    totalSessions,
    estimatedTotalThrows,
    phaseBreakdown,
  };
}
