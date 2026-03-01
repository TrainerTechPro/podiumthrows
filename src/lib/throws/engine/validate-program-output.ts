// ── Post-Generation Safety Audit ─────────────────────────────────────
// Validates a generated program for injury-risk patterns:
//   - ACWR (Acute-to-Chronic Workload Ratio) spikes
//   - Week-over-week volume spikes > 20%
//   - Absolute weekly ceiling violations
// Returns adjustments that can be applied to scale down flagged weeks.

import type { GeneratedProgram } from "./types";
import { reduceVolume } from "./scale-volume";
import type { VolumeTargets } from "./types";

// ── Types ────────────────────────────────────────────────────────────

export interface Adjustment {
  weekNumber: number;
  phaseIndex: number;
  originalThrows: number;
  adjustedThrows: number;
  reason: string;
}

export interface AuditResult {
  safe: boolean;
  warnings: string[];
  adjustments: Adjustment[];
}

// ── Constants ────────────────────────────────────────────────────────

const ACWR_THRESHOLD = 1.5;
const WEEK_SPIKE_THRESHOLD = 0.20; // 20%
const ABSOLUTE_WEEKLY_CEILING = 350;

// ── Main Audit Function ─────────────────────────────────────────────

/**
 * Audit a generated program for volume safety violations.
 *
 * Checks:
 * 1. ACWR: acute load (current week) vs chronic load (rolling avg of prior 4 weeks).
 *    Ratio > 1.5 is flagged.
 * 2. Week-over-week spike: any week > 20% above the prior week.
 * 3. Absolute ceiling: any week > 350 total throws.
 */
export function auditGeneratedProgram(program: GeneratedProgram): AuditResult {
  const warnings: string[] = [];
  const adjustments: Adjustment[] = [];

  // Flatten all weeks across phases with their total throws
  const weeklyLoads: Array<{
    weekNumber: number;
    phaseIndex: number;
    totalThrows: number;
  }> = [];

  for (let pi = 0; pi < program.phases.length; pi++) {
    const phase = program.phases[pi];
    for (const week of phase.weeks) {
      const totalThrows = week.sessions.reduce(
        (sum, s) => sum + s.totalThrowsTarget,
        0,
      );
      weeklyLoads.push({
        weekNumber: week.weekNumber,
        phaseIndex: pi,
        totalThrows,
      });
    }
  }

  // Sort by week number for sequential analysis
  weeklyLoads.sort((a, b) => a.weekNumber - b.weekNumber);

  for (let i = 0; i < weeklyLoads.length; i++) {
    const current = weeklyLoads[i];
    let targetThrows = current.totalThrows;
    const reasons: string[] = [];

    // Check 1: Absolute ceiling
    if (current.totalThrows > ABSOLUTE_WEEKLY_CEILING) {
      targetThrows = Math.min(targetThrows, ABSOLUTE_WEEKLY_CEILING);
      reasons.push(
        `Week ${current.weekNumber}: ${current.totalThrows} throws exceeds absolute ceiling of ${ABSOLUTE_WEEKLY_CEILING}`,
      );
    }

    // Check 2: Week-over-week spike (skip week 1)
    if (i > 0) {
      const previous = weeklyLoads[i - 1];
      if (previous.totalThrows > 0) {
        const increase =
          (current.totalThrows - previous.totalThrows) / previous.totalThrows;
        if (increase > WEEK_SPIKE_THRESHOLD) {
          const maxAllowed = Math.round(
            previous.totalThrows * (1 + WEEK_SPIKE_THRESHOLD),
          );
          targetThrows = Math.min(targetThrows, maxAllowed);
          reasons.push(
            `Week ${current.weekNumber}: ${Math.round(increase * 100)}% increase over prior week (max ${Math.round(WEEK_SPIKE_THRESHOLD * 100)}%)`,
          );
        }
      }
    }

    // Check 3: ACWR (starting from week 2)
    if (i >= 1) {
      const chronicWindow = weeklyLoads
        .slice(Math.max(0, i - 4), i)
        .map((w) => w.totalThrows);
      const chronicLoad =
        chronicWindow.reduce((a, b) => a + b, 0) / chronicWindow.length;

      if (chronicLoad > 0) {
        const acwr = current.totalThrows / chronicLoad;
        if (acwr > ACWR_THRESHOLD) {
          const maxAllowed = Math.round(chronicLoad * ACWR_THRESHOLD);
          targetThrows = Math.min(targetThrows, maxAllowed);
          reasons.push(
            `Week ${current.weekNumber}: ACWR ${acwr.toFixed(2)} exceeds threshold ${ACWR_THRESHOLD}`,
          );
        }
      }
    }

    if (reasons.length > 0) {
      warnings.push(...reasons);
      if (targetThrows < current.totalThrows) {
        adjustments.push({
          weekNumber: current.weekNumber,
          phaseIndex: current.phaseIndex,
          originalThrows: current.totalThrows,
          adjustedThrows: targetThrows,
          reason: reasons.join("; "),
        });
      }
    }
  }

  return {
    safe: adjustments.length === 0,
    warnings,
    adjustments,
  };
}

// ── Apply Adjustments ───────────────────────────────────────────────

/**
 * Apply safety adjustments to a generated program.
 * Deep-copies the program and scales down throws in flagged weeks
 * proportionally using reduceVolume().
 */
export function applyAdjustments(
  program: GeneratedProgram,
  adjustments: Adjustment[],
): GeneratedProgram {
  // Deep copy
  const adjusted: GeneratedProgram = JSON.parse(JSON.stringify(program));

  for (const adj of adjustments) {
    const phase = adjusted.phases[adj.phaseIndex];
    if (!phase) continue;

    const week = phase.weeks.find((w) => w.weekNumber === adj.weekNumber);
    if (!week) continue;

    const currentTotal = week.sessions.reduce(
      (sum, s) => sum + s.totalThrowsTarget,
      0,
    );
    if (currentTotal <= 0) continue;

    const reductionPercent =
      ((currentTotal - adj.adjustedThrows) / currentTotal) * 100;

    // Scale down each session proportionally
    for (const session of week.sessions) {
      if (session.totalThrowsTarget <= 0) continue;

      const sessionTargets: VolumeTargets = {
        throwsPerWeek: session.totalThrowsTarget,
        throwsPerSession: { [session.dayType]: session.totalThrowsTarget },
        strengthDaysPerWeek: 0,
      };

      const reduced = reduceVolume(sessionTargets, reductionPercent);
      session.totalThrowsTarget = reduced.throwsPerWeek;

      // Scale down individual throw prescriptions proportionally
      const factor = 1 - reductionPercent / 100;
      for (const throwRx of session.throws) {
        const newTotal = Math.max(
          1,
          Math.round(throwRx.sets * throwRx.repsPerSet * factor),
        );
        throwRx.sets = Math.max(1, Math.round(newTotal / throwRx.repsPerSet));
      }
    }
  }

  // Recompute summary
  let totalSessions = 0;
  let estimatedTotalThrows = 0;
  for (const phase of adjusted.phases) {
    for (const week of phase.weeks) {
      for (const session of week.sessions) {
        totalSessions++;
        estimatedTotalThrows += session.totalThrowsTarget;
      }
    }
  }
  adjusted.summary.totalSessions = totalSessions;
  adjusted.summary.estimatedTotalThrows = estimatedTotalThrows;

  return adjusted;
}
