// ── Self-Program Adapter ─────────────────────────────────────────────
// Transforms SelfProgramConfig (wizard answers) into ProgramConfig
// for the Bondarchuk training engine.

import type { ProgramConfig, TypingSnapshot, ImplementEntry, LiftingPrs } from "@/lib/throws/engine/types";
import type { ThrowEvent, Gender } from "@/lib/throws/constants";
import { EVENT_CODE_MAP, GENDER_CODE_MAP, classifyBand } from "@/lib/throws/constants";
import { DEFAULT_FACILITIES, DEFAULT_LIFTING_PRS, DEFAULT_TYPING } from "./defaults";

// ── Types ────────────────────────────────────────────────────────────

/** Shape of a SelfProgramConfig row without Prisma metadata fields. */
interface SelfProgramConfigInput {
  athleteProfileId: string;
  trainingProgramId?: string | null;
  programType: string;
  event: string;
  gender: string;
  yearsExperience: number;
  competitionLevel: string;
  currentPR: number;
  goalDistance: number;
  currentWeeklyVolume?: number | null;
  availableImplements: unknown; // JSON — ImplementEntry[]
  daysPerWeek: number;
  sessionsPerDay: number;
  preferredDays: unknown; // JSON
  startDate: Date;
  competitionDates?: unknown; // JSON — {date, name, priority}[] | null
  primaryGoal: string;
  generationMode: string;
  exercisePreferences?: unknown; // JSON
  usedExistingTyping: boolean;
  inlineTypingData?: unknown; // JSON — TypingSnapshot | null
  isActive: boolean;
  isDraft: boolean;
  generationCount: number;
  currentPhaseIndex: number;
}

interface CompetitionDateEntry {
  date: string;
  name: string;
  priority: string; // "A_MEET" | "B_MEET" | "C_MEET"
}

interface BenchmarksJson {
  squat1RM?: number;
  bench1RM?: number;
  clean1RM?: number;
  snatch1RM?: number;
  ohp1RM?: number;
  deadlift1RM?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addWeeks(date: Date, weeks: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + weeks * 7);
  return result;
}

/**
 * Find the earliest A-meet date from the competition dates array.
 * Returns null if no A-meet exists.
 */
function findFirstAMeetDate(competitionDates: unknown): string | null {
  if (!Array.isArray(competitionDates) || competitionDates.length === 0) {
    return null;
  }

  const aMeets = (competitionDates as CompetitionDateEntry[])
    .filter((c) => c.priority === "A_MEET")
    .sort((a, b) => a.date.localeCompare(b.date));

  return aMeets.length > 0 ? aMeets[0].date : null;
}

/**
 * Resolve typing data with priority:
 * 1. Existing typing from ThrowsTyping table
 * 2. Inline typing collected during wizard
 * 3. DEFAULT_TYPING fallback
 */
function resolveTyping(
  existingTyping: TypingSnapshot | null,
  inlineTypingData: unknown,
): TypingSnapshot {
  if (existingTyping) return existingTyping;
  if (inlineTypingData && typeof inlineTypingData === "object") {
    return inlineTypingData as TypingSnapshot;
  }
  return DEFAULT_TYPING;
}

/**
 * Parse performanceBenchmarks JSON into LiftingPrs.
 * Maps field names: squat1RM → squatKg, bench1RM → benchKg, etc.
 */
function parseLiftingPrs(
  benchmarksJson: string | null,
  bodyWeightKg?: number | null,
): LiftingPrs {
  if (!benchmarksJson) {
    return {
      ...DEFAULT_LIFTING_PRS,
      bodyWeightKg: bodyWeightKg ?? DEFAULT_LIFTING_PRS.bodyWeightKg,
    };
  }

  let parsed: BenchmarksJson;
  try {
    parsed = JSON.parse(benchmarksJson) as BenchmarksJson;
  } catch {
    return {
      ...DEFAULT_LIFTING_PRS,
      bodyWeightKg: bodyWeightKg ?? DEFAULT_LIFTING_PRS.bodyWeightKg,
    };
  }

  return {
    squatKg: parsed.squat1RM,
    benchKg: parsed.bench1RM,
    cleanKg: parsed.clean1RM,
    snatchKg: parsed.snatch1RM,
    ohpKg: parsed.ohp1RM,
    deadliftKg: parsed.deadlift1RM,
    bodyWeightKg: bodyWeightKg ?? DEFAULT_LIFTING_PRS.bodyWeightKg,
  };
}

// ── Main Adapter ─────────────────────────────────────────────────────

/**
 * Build a ProgramConfig from SelfProgramConfig wizard answers.
 *
 * @param config       - SelfProgramConfig row (without id/createdAt/updatedAt)
 * @param existingTyping - Existing ThrowsTyping snapshot if the athlete already has one
 * @param performanceBenchmarks - JSON string of lifting PRs from athlete profile
 * @param bodyWeightKg - Athlete's body weight in kg
 * @returns ProgramConfig ready for the generation engine
 */
export function buildProgramConfig(
  config: SelfProgramConfigInput,
  existingTyping: TypingSnapshot | null,
  performanceBenchmarks: string | null,
  bodyWeightKg?: number | null,
): ProgramConfig {
  const event = config.event as ThrowEvent;
  const gender = config.gender as Gender;
  const eventCode = EVENT_CODE_MAP[event];
  const genderCode = GENDER_CODE_MAP[gender];

  // Derive distance band
  const distanceBand = classifyBand(eventCode, genderCode, config.currentPR) ?? "unknown";

  // Resolve target date: first A-meet or startDate + 16 weeks
  const aMeetDate = findFirstAMeetDate(config.competitionDates);
  const startDateStr = formatDate(config.startDate);
  const targetDate = aMeetDate ?? formatDate(addWeeks(config.startDate, 16));

  // Resolve typing
  const typing = resolveTyping(existingTyping, config.inlineTypingData);

  // Resolve lifting PRs
  const liftingPrs = parseLiftingPrs(performanceBenchmarks, bodyWeightKg);

  // Map programType to includeLift
  const includeLift = config.programType === "THROWS_AND_LIFTING";

  // Parse available implements
  const availableImplements = (config.availableImplements as ImplementEntry[]) ?? [];

  return {
    event,
    eventCode,
    gender,
    genderCode,
    competitionPr: config.currentPR,
    distanceBand,
    startDate: startDateStr,
    targetDate,
    goalDistance: config.goalDistance,
    daysPerWeek: config.daysPerWeek,
    sessionsPerDay: config.sessionsPerDay,
    includeLift,
    adaptationGroup: typing.adaptationGroup,
    sessionsToForm: typing.sessionsToForm,
    recommendedMethod: typing.recommendedMethod,
    transferType: typing.transferType,
    recoveryProfile: typing.recoveryProfile,
    availableImplements,
    facilities: DEFAULT_FACILITIES,
    liftingPrs,
    yearsThrowing: config.yearsExperience,
    currentWeeklyVolume: config.currentWeeklyVolume ?? undefined,
  };
}
