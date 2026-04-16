/**
 * Taper-phase classifier for competition countdown visuals.
 *
 * Thresholds match the coach dashboard's existing CompetitionCountdown
 * (≤21d amber, ≤7d red, =0 race day) so coaches see consistent cues
 * across surfaces. A separate periodization engine (`elite-taper.ts`)
 * computes adaptation-group-aware taper multipliers for programming;
 * this module is purely for visual phase tinting.
 */

export type TaperPhase = "taper" | "peak" | "race" | null;

/**
 * Classify a day relative to a competition date.
 *
 * - `daysOut === 0` → race day
 * - `1 ≤ daysOut ≤ 7` → peak
 * - `8 ≤ daysOut ≤ 21` → taper
 * - anything else (past or far future) → null
 */
export function getTaperPhase(daysOut: number): TaperPhase {
  if (!Number.isFinite(daysOut)) return null;
  if (daysOut === 0) return "race";
  if (daysOut >= 1 && daysOut <= 7) return "peak";
  if (daysOut >= 8 && daysOut <= 21) return "taper";
  return null;
}

/**
 * Days between two YYYY-MM-DD date strings as interpreted in local time.
 * Positive when `target` is after `from`.
 */
export function daysBetween(fromStr: string, targetStr: string): number {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = targetStr.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd);
  const target = new Date(ty, tm - 1, td);
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((target.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * For a given calendar day, pick the most "urgent" competition phase among
 * all upcoming competitions. Race beats peak, peak beats taper. A day can
 * show at most one phase tint even if two athletes have meets 5 and 14
 * days out — the nearer meet wins because its tint is the actionable one.
 */
export function pickPhaseForDay(dayStr: string, upcomingCompetitionDates: string[]): TaperPhase {
  let best: TaperPhase = null;
  for (const compDate of upcomingCompetitionDates) {
    const phase = getTaperPhase(daysBetween(dayStr, compDate));
    if (phase === "race") return "race";
    if (phase === "peak") best = "peak";
    else if (phase === "taper" && best === null) best = "taper";
  }
  return best;
}
