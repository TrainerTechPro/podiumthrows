/**
 * Pure milestone-detection helpers for athlete goals.
 *
 * Milestones fire when progress crosses 25%, 50%, 75%, or 100% — but only the
 * first time. `Goal.celebratedMilestones` persists which thresholds have
 * already fired so progress oscillating around a threshold doesn't toast
 * twice.
 */

export const MILESTONE_THRESHOLDS = [25, 50, 75, 100] as const;
export type MilestoneThreshold = (typeof MILESTONE_THRESHOLDS)[number];

export interface ProgressInputs {
  startingValue: number | null;
  currentValue: number;
  targetValue: number;
}

/**
 * Compute progress as an integer percentage from 0–100. Mirrors the formula
 * used in the goals API and the goals client. Preserves 0 starting/current
 * values (CLAUDE.md rule 3) — only `null` startingValue falls back to 0.
 */
export function computeProgressPct({
  startingValue,
  currentValue,
  targetValue,
}: ProgressInputs): number {
  const baseline = startingValue ?? 0;
  const range = targetValue - baseline;
  if (range <= 0) return 0;
  const gained = currentValue - baseline;
  const pct = Math.round((gained / range) * 100);
  return Math.min(100, Math.max(0, pct));
}

/**
 * Returns the thresholds (subset of [25, 50, 75, 100]) that the progress
 * crosses, excluding any already in `alreadyCelebrated`. Idempotent: if
 * progress jumps from 10 → 80, returns [25, 50, 75]; if those have already
 * fired, returns [].
 */
export function newMilestonesCrossed(
  nextPct: number,
  alreadyCelebrated: number[]
): MilestoneThreshold[] {
  const fired = new Set(alreadyCelebrated);
  const crossed: MilestoneThreshold[] = [];
  for (const threshold of MILESTONE_THRESHOLDS) {
    if (nextPct >= threshold && !fired.has(threshold)) {
      crossed.push(threshold);
    }
  }
  return crossed;
}

export interface MilestoneCelebration {
  goalId: string;
  goalTitle: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  progressPct: number;
  /** Thresholds crossed by this update, in ascending order. */
  thresholds: MilestoneThreshold[];
  /** True iff the highest threshold crossed is 100 — the goal is now done. */
  completed: boolean;
}

/**
 * Build a celebration record for a single goal update. Returns null when no
 * new milestones were crossed.
 */
export function buildCelebration(
  goal: {
    id: string;
    title: string;
    unit: string;
    targetValue: number;
    startingValue: number | null;
    celebratedMilestones: number[];
  },
  nextCurrentValue: number
): MilestoneCelebration | null {
  const progressPct = computeProgressPct({
    startingValue: goal.startingValue,
    currentValue: nextCurrentValue,
    targetValue: goal.targetValue,
  });
  const thresholds = newMilestonesCrossed(progressPct, goal.celebratedMilestones);
  if (thresholds.length === 0) return null;
  return {
    goalId: goal.id,
    goalTitle: goal.title,
    unit: goal.unit,
    targetValue: goal.targetValue,
    currentValue: nextCurrentValue,
    progressPct,
    thresholds,
    completed: thresholds.includes(100),
  };
}

/**
 * Friendly toast copy for a milestone celebration. Mid-thresholds get a
 * "X to go" hook so the athlete knows exactly what's next; 100 gets the
 * congratulatory headline (the full overlay handles the visual moment).
 */
export function celebrationCopy(c: MilestoneCelebration): { title: string; body?: string } {
  const remaining = Math.max(0, c.targetValue - c.currentValue);
  const top = c.thresholds[c.thresholds.length - 1]!;
  const remainingLabel = `${formatNumber(remaining)} ${c.unit} to go`;

  if (top === 100) {
    return { title: `🏆 Goal complete — ${c.goalTitle}` };
  }
  if (top === 75) {
    return {
      title: `Three-quarters there — ${c.goalTitle}`,
      body: remainingLabel,
    };
  }
  if (top === 50) {
    return {
      title: `Halfway to your ${c.goalTitle.toLowerCase()}`,
      body: remainingLabel,
    };
  }
  // 25
  return {
    title: `Off to a strong start — ${c.goalTitle}`,
    body: `${c.progressPct}% there`,
  };
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, "");
}
