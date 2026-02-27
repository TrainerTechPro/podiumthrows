// ── Week Generator ──────────────────────────────────────────────────
// Generates a full training week from the WEEKLY_SCHEDULES template,
// filtered to the athlete's requested days per week.

import { WEEKLY_SCHEDULES } from "../constants";
import type { TrainingPhase } from "../constants";
import { generateSession } from "./generate-session";
import type {
  GeneratedWeek,
  GeneratedSession,
  WeekGenConfig,
} from "./types";

// ── Day-of-week mapping ─────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

// ── Main Function ───────────────────────────────────────────────────

/**
 * Generate one training week.
 *
 * 1. Gets the phase's weekly schedule template
 * 2. Filters to athlete's daysPerWeek (prioritizing A/C/B types over E/MEET)
 * 3. Generates each daily session
 */
export function generateWeek(config: WeekGenConfig): GeneratedWeek {
  const {
    weekNumber,
    phase,
    daysPerWeek,
    sessionsPerDay,
    includeLift,
    throwsPerWeekTarget,
    strengthDaysTarget,
    exerciseComplex,
    programConfig,
  } = config;

  // Get base schedule template
  const template = WEEKLY_SCHEDULES[phase];
  if (!template || template.length === 0) {
    return { weekNumber, sessions: [] };
  }

  // Select which days to keep based on daysPerWeek
  const selectedDays = selectDays(template, daysPerWeek, phase);

  // Scale throws proportionally to fill weekly target
  const templateTotalThrows = selectedDays.reduce(
    (sum, d) => sum + (d.throwsMin + d.throwsMax) / 2,
    0,
  );
  const scaleFactor =
    templateTotalThrows > 0 ? throwsPerWeekTarget / templateTotalThrows : 1;

  // Track which days get strength
  const strengthDayTypes = selectStrengthDays(selectedDays, strengthDaysTarget);

  const sessions: GeneratedSession[] = [];

  for (const day of selectedDays) {
    const dayOfWeek = DAY_MAP[day.day] ?? 1;
    const scaledMin = Math.round(day.throwsMin * scaleFactor);
    const scaledMax = Math.round(day.throwsMax * scaleFactor);

    // Determine strength level for this day
    const hasStrength = strengthDayTypes.has(day.type);
    const strengthLevel = hasStrength ? day.strength : "None";

    const session = generateSession({
      weekNumber,
      dayOfWeek,
      dayType: day.type,
      focus: day.focus,
      throwsMin: scaledMin,
      throwsMax: scaledMax,
      strengthLevel,
      phase,
      exerciseComplex,
      includeLift,
      programConfig,
    });

    sessions.push(session);

    // If 2 sessions per day and this is an A-type day, add a PM session
    if (sessionsPerDay === 2 && (day.type === "A" || day.type === "C")) {
      const pmSession = generateSession({
        weekNumber,
        dayOfWeek,
        dayType: `${day.type}-PM`,
        focus: `${day.focus} (PM)`,
        throwsMin: Math.round(scaledMin * 0.4),
        throwsMax: Math.round(scaledMax * 0.4),
        strengthLevel: hasStrength ? "Light" : "None",
        phase,
        exerciseComplex,
        includeLift,
        programConfig,
      });
      sessions.push(pmSession);
    }
  }

  return { weekNumber, sessions };
}

// ── Day Selection ───────────────────────────────────────────────────

/**
 * Select which days from the template to keep based on daysPerWeek.
 * Prioritizes primary training days (A, C, D) over support days (B, E).
 */
function selectDays(
  template: typeof WEEKLY_SCHEDULES[TrainingPhase],
  daysPerWeek: number,
  _phase: TrainingPhase,
): typeof template {
  if (daysPerWeek >= template.length) {
    return template;
  }

  // Priority order for day types
  const PRIORITY: Record<string, number> = {
    A: 1,   // High Volume Technical
    C: 2,   // Speed/Technical
    D: 3,   // Competition Sim
    MEET: 3, // Competition
    B: 4,   // Strength Emphasis
    E: 5,   // Recovery
  };

  // Sort by priority, then pick top N
  const sorted = [...template].sort(
    (a, b) => (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9),
  );

  return sorted.slice(0, daysPerWeek);
}

/**
 * Select which day types should include strength training.
 */
function selectStrengthDays(
  days: Array<{ type: string; strength: string }>,
  strengthDaysTarget: number,
): Set<string> {
  if (strengthDaysTarget <= 0) return new Set();

  // Priority: B (Strength Emphasis) > A (Moderate) > C (Low) > E (Light)
  const STRENGTH_PRIORITY: Record<string, number> = {
    High: 1,
    Moderate: 2,
    Low: 3,
    Light: 4,
    "Very Low": 5,
    None: 99,
  };

  const ranked = [...days]
    .filter((d) => d.strength !== "None")
    .sort(
      (a, b) =>
        (STRENGTH_PRIORITY[a.strength] ?? 99) -
        (STRENGTH_PRIORITY[b.strength] ?? 99),
    );

  const selectedTypes = new Set<string>();
  for (let i = 0; i < Math.min(strengthDaysTarget, ranked.length); i++) {
    selectedTypes.add(ranked[i].type);
  }

  return selectedTypes;
}
