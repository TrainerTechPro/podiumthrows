// ── Athlete Profile & Bondarchuk Typing Utility Functions ─────────────
// Scoring, readiness calculation, typing quiz scoring, and data-driven
// refinement functions.

import type { QuizOption } from "./profile-constants";
import type { EventCode, GenderCode } from "./constants";
import { CORRELATIONS } from "./correlations";

// ── Statistical Functions ─────────────────────────────────────────────

export function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3 || n !== y.length) return null;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

export function linearSlope(y: number[]): number {
  const n = y.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (y[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// ── Readiness Score ───────────────────────────────────────────────────

export interface ReadinessResult {
  score: number | null;
  label: string;
  color: string;
  breakdown: Record<string, number>;
}

export interface CheckInData {
  selfFeeling: number;
  sleepHours?: number | null;
  sleepQuality?: number | null;
  energy?: number | null;
  sorenessGeneral?: number | null;
  sorenessShoulder?: number | null;
  sorenessBack?: number | null;
  sorenessHip?: number | null;
  sorenessKnee?: number | null;
  sorenessElbow?: number | null;
  sorenessWrist?: number | null;
}

export function calcReadiness(
  checkin: CheckInData,
  selfFeelingAccuracy: "accurate" | "moderate" | "poor" = "moderate",
  recentThrowCount: number = 0,
  avgThrowCount: number = 0,
  daysSinceLastSession: number = 1,
): ReadinessResult {
  const weights = {
    accurate: { feeling: 0.30, sleep: 0.20, soreness: 0.15, energy: 0.10, volume: 0.15, rest: 0.10 },
    moderate: { feeling: 0.20, sleep: 0.20, soreness: 0.15, energy: 0.15, volume: 0.15, rest: 0.15 },
    poor:     { feeling: 0.10, sleep: 0.20, soreness: 0.15, energy: 0.20, volume: 0.20, rest: 0.15 },
  }[selfFeelingAccuracy];

  // Self-feeling: 1-5 → 0-100
  const feelingScore = ((checkin.selfFeeling - 1) / 4) * 100;

  // Sleep composite
  let sleepScore = ((checkin.sleepQuality ?? 3) - 1) / 4 * 100;
  const hours = checkin.sleepHours ?? 7;
  if (hours < 6) sleepScore *= 0.6;
  else if (hours < 7) sleepScore *= 0.8;
  else if (hours > 10) sleepScore *= 0.85;

  // Soreness inverse
  const sorenessValues = [
    checkin.sorenessGeneral, checkin.sorenessShoulder, checkin.sorenessBack,
    checkin.sorenessHip, checkin.sorenessKnee, checkin.sorenessElbow, checkin.sorenessWrist,
  ].filter((v): v is number => v != null);
  const avgSoreness = sorenessValues.length > 0
    ? sorenessValues.reduce((a, b) => a + b, 0) / sorenessValues.length
    : 0;
  const sorenessScore = Math.max(0, 100 - avgSoreness * 10);

  // Energy: 1-10 → 0-100
  const energyScore = (((checkin.energy ?? 5) - 1) / 9) * 100;

  // Volume load
  const volumeRatio = avgThrowCount > 0 ? recentThrowCount / avgThrowCount : 1;
  let volumeScore = 100;
  if (volumeRatio > 1.3) volumeScore = 60;
  else if (volumeRatio > 1.15) volumeScore = 80;
  else if (volumeRatio < 0.7) volumeScore = 90;

  // Rest
  let restScore = 90;
  if (daysSinceLastSession === 0) restScore = 60;
  else if (daysSinceLastSession === 1) restScore = 100;
  else if (daysSinceLastSession === 2) restScore = 90;
  else restScore = 70;

  const score = Math.round(
    feelingScore * weights.feeling +
    sleepScore * weights.sleep +
    sorenessScore * weights.soreness +
    energyScore * weights.energy +
    volumeScore * weights.volume +
    restScore * weights.rest,
  );

  const clamped = Math.min(100, Math.max(0, score));

  let label: string, color: string;
  if (clamped >= 80) { label = "Ready to throw"; color = "#5BB88A"; }
  else if (clamped >= 60) { label = "Moderate — monitor closely"; color = "#D4915A"; }
  else { label = "Consider rest or light technical work"; color = "#D46A6A"; }

  return {
    score: clamped,
    label,
    color,
    breakdown: { feelingScore, sleepScore, sorenessScore, energyScore, volumeScore, restScore },
  };
}

// ── Adaptation Progress ───────────────────────────────────────────────

export interface AdaptationResult {
  progress: number;
  phase: "no-complex" | "loading" | "adapting" | "approaching" | "in-form" | "readaptation-risk";
  label: string;
}

export function calcAdaptationProgress(
  sessionsInComplex: number,
  marks: number[],
  enteredSportsForm: boolean,
  weeksSinceForm: number = 0,
): AdaptationResult {
  if (sessionsInComplex === 0) {
    return { progress: 0, phase: "no-complex", label: "No active complex" };
  }

  // Phase 1: Loading (sessions 1-5)
  if (sessionsInComplex < 5) {
    return {
      progress: Math.round((sessionsInComplex / 5) * 30),
      phase: "loading",
      label: "Loading",
    };
  }

  // Phase 3: Already in form
  if (enteredSportsForm) {
    if (weeksSinceForm < 3) {
      return { progress: 97, phase: "in-form", label: "IN FORM" };
    }
    return {
      progress: Math.max(60, 95 - (weeksSinceForm - 3) * 5),
      phase: "readaptation-risk",
      label: "Readaptation Risk — Change Complex",
    };
  }

  // Phase 2: Adapting
  if (marks.length < 3) {
    return { progress: 35, phase: "adapting", label: "Adapting" };
  }

  const recentMarks = marks.slice(-5);
  const slope = linearSlope(recentMarks);
  const maxMark = Math.max(...recentMarks);
  const minMark = Math.min(...recentMarks);
  const oscillation = maxMark > 0 ? (maxMark - minMark) / maxMark : 0;

  if (slope <= 0.01 && oscillation < 0.03 && marks.length >= 5) {
    return {
      progress: Math.min(95, 70 + Math.round((1 - oscillation / 0.05) * 25)),
      phase: "approaching",
      label: "Approaching Form",
    };
  }

  // Normalizing improvement for adapting phase (30-70%)
  const firstMarks = marks.slice(0, Math.min(5, marks.length));
  const firstAvg = firstMarks.reduce((a, b) => a + b, 0) / firstMarks.length;
  const recentAvg = recentMarks.reduce((a, b) => a + b, 0) / recentMarks.length;
  const improvement = firstAvg > 0 ? (recentAvg - firstAvg) / firstAvg : 0;
  const normalizedImprovement = Math.min(1, Math.max(0, improvement * 20));

  return {
    progress: Math.round(30 + normalizedImprovement * 40),
    phase: "adapting",
    label: "Adapting",
  };
}

// ── Transfer Index ────────────────────────────────────────────────────

export interface TransferResult {
  score: number | null;
  exercises: Array<{
    name: string;
    expectedR: number;
    observedR: number | null;
    status: "strong" | "normal" | "weak" | "negative" | "collecting";
    sessions: number;
  }>;
}

/**
 * Compute the Transfer Index for the athlete's current complex.
 *
 * Looks up each exercise in the Bondarchuk correlation database for the
 * athlete's event, gender, and performance band, then averages the
 * expected correlation coefficients and scales to 0-100.
 *
 * SD exercises (direct speed-strength) are weighted 2× vs SP exercises
 * (specific preparation) because they have more direct carryover.
 */
/**
 * Maps STRENGTH_DB display names (and common free-text variants) to the
 * canonical exercise names used in the Bondarchuk correlation database.
 */
const EXERCISE_ALIAS: Record<string, string> = {
  // Snatch variants
  "barbell snatch": "Snatch",
  "power snatch": "Snatch",
  // Squat variants
  "back squat": "Squat",
  "front squat": "Squat",
  "half squat": "Squat",
  "box squat": "Squat",
  // Power Clean is already an exact match
  // Bench Press is already an exact match
  // Sprint variants
  "sprint": "30m Sprint",
  "30m sprint": "30m Sprint",
  "60m sprint": "30m Sprint",
  // Jump variants
  "box jumps": "Vertical Jump",
  "box jump": "Vertical Jump",
  "vertical jump": "Vertical Jump",
  "standing broad jump": "Standing Long Jump",
  "standing long jump": "Standing Long Jump",
  "bounding": "Standing Long Jump",
  "triple jump": "Triple Jump Place",
};

export function calcTransferIndex(
  event: EventCode,
  gender: GenderCode,
  exercises: string[],
  prDistance: number,
): TransferResult {
  if (!exercises.length) return { score: null, exercises: [] };

  type ExStatus = "strong" | "normal" | "weak" | "negative" | "collecting";
  const toStatus = (r: number): ExStatus =>
    r >= 0.7 ? "strong" : r >= 0.5 ? "normal" : r >= 0.0 ? "weak" : "negative";

  let weightedSum = 0;
  let totalWeight = 0;
  const exerciseResults: TransferResult["exercises"] = [];

  for (const exerciseName of exercises) {
    const nameLower = exerciseName.toLowerCase().trim();
    // Resolve via alias map first, then fall through to fuzzy search
    const resolvedName = EXERCISE_ALIAS[nameLower] ?? exerciseName;
    const resolvedLower = resolvedName.toLowerCase();

    // Priority 1: exact resolved name + distance band
    let match = CORRELATIONS.find(
      (c) =>
        c.event === event &&
        c.gender === gender &&
        c.exercise.toLowerCase() === resolvedLower &&
        prDistance >= c.minMeters &&
        prDistance < c.maxMeters,
    );

    // Priority 2: exact resolved name, any band (closest distance)
    if (!match) {
      const candidates = CORRELATIONS.filter(
        (c) =>
          c.event === event &&
          c.gender === gender &&
          c.exercise.toLowerCase() === resolvedLower,
      ).sort((a, b) => {
        const mid = (c: typeof a) => (c.minMeters + c.maxMeters) / 2;
        return Math.abs(mid(a) - prDistance) - Math.abs(mid(b) - prDistance);
      });
      match = candidates[0];
    }

    // Priority 3: prefix fuzzy on resolved name + distance band
    if (!match && resolvedLower.length >= 5) {
      match = CORRELATIONS.find(
        (c) =>
          c.event === event &&
          c.gender === gender &&
          c.exercise.toLowerCase().startsWith(resolvedLower.slice(0, 5)) &&
          prDistance >= c.minMeters &&
          prDistance < c.maxMeters,
      );
    }

    // Priority 4: prefix fuzzy, closest band
    if (!match && resolvedLower.length >= 5) {
      const candidates = CORRELATIONS.filter(
        (c) =>
          c.event === event &&
          c.gender === gender &&
          c.exercise.toLowerCase().startsWith(resolvedLower.slice(0, 5)),
      ).sort((a, b) => {
        const mid = (c: typeof a) => (c.minMeters + c.maxMeters) / 2;
        return Math.abs(mid(a) - prDistance) - Math.abs(mid(b) - prDistance);
      });
      match = candidates[0];
    }

    if (!match) continue; // Unrecognised exercise name — skip

    const weight = match.type === "SD" ? 2 : 1;
    weightedSum += match.correlation * weight;
    totalWeight += weight;
    exerciseResults.push({
      name: exerciseName,
      expectedR: match.correlation,
      observedR: null,
      status: toStatus(match.correlation),
      sessions: 0,
    });
  }

  if (!exerciseResults.length) return { score: null, exercises: [] };

  const avgR = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const score = Math.round(Math.max(0, Math.min(100, avgR * 100)));

  return { score, exercises: exerciseResults };
}

// ── Typing Quiz Scoring ───────────────────────────────────────────────

export function scoreAdaptationSpeed(responses: QuizOption["score"][]) {
  let g1 = 0, g2 = 0, g3 = 0;
  responses.forEach((r) => {
    g1 += r.g1 || 0;
    g2 += r.g2 || 0;
    g3 += r.g3 || 0;
  });
  const total = g1 + g2 + g3;
  const max = Math.max(g1, g2, g3);
  if (g1 === max) return { group: 1 as const, label: "Fast Adapter", confidence: total > 0 ? Math.round((g1 / total) * 100) : 50 };
  if (g3 === max) return { group: 3 as const, label: "Slow Adapter", confidence: total > 0 ? Math.round((g3 / total) * 100) : 50 };
  return { group: 2 as const, label: "Moderate Adapter", confidence: total > 0 ? Math.round((g2 / total) * 100) : 50 };
}

export function scoreTransferType(responses: QuizOption["score"][]) {
  let heavy = 0, comp = 0, balanced = 0;
  responses.forEach((r) => {
    heavy += r.heavy || 0;
    comp += r.comp || 0;
    balanced += r.balanced || 0;
  });
  const total = heavy + comp + balanced;
  const max = Math.max(heavy, comp, balanced);
  if (heavy === max) return { type: "heavy-dominant" as const, label: "Heavy-Dominant", confidence: total > 0 ? Math.round((heavy / total) * 100) : 50 };
  if (comp === max) return { type: "competition-dominant" as const, label: "Competition-Dominant", confidence: total > 0 ? Math.round((comp / total) * 100) : 50 };
  return { type: "balanced" as const, label: "Balanced", confidence: total > 0 ? Math.round((balanced / total) * 100) : 50 };
}

export function scoreSelfFeelingAccuracy(responses: QuizOption["score"][]) {
  let accurate = 0, moderate = 0, poor = 0;
  responses.forEach((r) => {
    accurate += r.accurate || 0;
    moderate += r.moderate || 0;
    poor += r.poor || 0;
  });
  const total = accurate + moderate + poor;
  const max = Math.max(accurate, moderate, poor);
  if (accurate === max) return { accuracy: "accurate" as const, label: "Accurate", confidence: total > 0 ? Math.round((accurate / total) * 100) : 50 };
  if (poor === max) return { accuracy: "poor" as const, label: "Poor", confidence: total > 0 ? Math.round((poor / total) * 100) : 50 };
  return { accuracy: "moderate" as const, label: "Moderate", confidence: total > 0 ? Math.round((moderate / total) * 100) : 50 };
}

export function scoreLightImplResponse(responses: QuizOption["score"][]) {
  let normal = 0, tolerant = 0;
  responses.forEach((r) => {
    normal += r.normal || 0;
    tolerant += r.tolerant || 0;
  });
  const total = normal + tolerant;
  if (normal >= tolerant) return { response: "normal-87pct" as const, label: "Normal (87% group)", confidence: total > 0 ? Math.round((normal / total) * 100) : 50 };
  return { response: "tolerant-13pct" as const, label: "Tolerant (13% group)", confidence: total > 0 ? Math.round((tolerant / total) * 100) : 50 };
}

export function scoreRecoveryProfile(responses: QuizOption["score"][]) {
  let fast = 0, standard = 0, slow = 0;
  responses.forEach((r) => {
    fast += r.fast || 0;
    standard += r.standard || 0;
    slow += r.slow || 0;
  });
  const total = fast + standard + slow;
  const max = Math.max(fast, standard, slow);
  if (fast === max) return { profile: "fast" as const, label: "Fast", confidence: total > 0 ? Math.round((fast / total) * 100) : 50 };
  if (slow === max) return { profile: "slow" as const, label: "Slow", confidence: total > 0 ? Math.round((slow / total) * 100) : 50 };
  return { profile: "standard" as const, label: "Standard", confidence: total > 0 ? Math.round((standard / total) * 100) : 50 };
}

// ── Recommended Method ────────────────────────────────────────────────

export function computeRecommendedMethod(
  adaptationGroup: number,
  recoveryProfile: string,
): { method: string; reason: string; complexDuration: string; sessionsToForm: number } {
  if (adaptationGroup === 3) {
    return {
      method: "complex",
      reason: "Group 3 (slow) adapters never enter sports form with Variation method. Complex method is mandatory.",
      complexDuration: "5-7 weeks",
      sessionsToForm: 28,
    };
  }
  if (adaptationGroup === 1) {
    return {
      method: "complex",
      reason: "Fast adapters peak quickly with Complex method. Rotate complexes every 3-4 weeks to avoid readaptation.",
      complexDuration: "3-4 weeks",
      sessionsToForm: 10,
    };
  }
  if (recoveryProfile === "fast") {
    return {
      method: "complex",
      reason: "Moderate adapter with fast recovery — Complex method with 4-5 week cycles.",
      complexDuration: "4-5 weeks",
      sessionsToForm: 18,
    };
  }
  return {
    method: "stage-complex",
    reason: "Moderate adapter with standard/slow recovery — Stage-Complex method with 4-5 week cycles.",
    complexDuration: "4-5 weeks",
    sessionsToForm: 20,
  };
}

// ── Taper Plan ────────────────────────────────────────────────────────

export function generateTaperPlan(daysOut: number): { daysOut: number; volumeMultiplier: number } | null {
  if (daysOut > 7) return null;
  const TAPER = [
    { daysOut: 7, volumeMultiplier: 0.70 },
    { daysOut: 5, volumeMultiplier: 0.50 },
    { daysOut: 3, volumeMultiplier: 0.30 },
    { daysOut: 1, volumeMultiplier: 0.10 },
  ];
  for (const t of TAPER) {
    if (daysOut >= t.daysOut) return t;
  }
  return { daysOut: 0, volumeMultiplier: 0.10 };
}

// ── Date Helpers ──────────────────────────────────────────────────────

export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
