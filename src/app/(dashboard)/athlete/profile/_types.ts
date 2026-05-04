// Types shared across all profile tab components

import type { EventType, Gender } from "@prisma/client";

/* ─── AthleteProfile data from server component ─────────────────────── */

export type ProfileData = {
  id: string;
  firstName: string;
  lastName: string;
  events: EventType[];
  gender: Gender;
  dateOfBirth: string | null;
  avatarUrl: string | null;
  heightCm: number | null;
  weightKg: number | null;
  turnDirection: string | null;
  classStanding: string | null;
  gradYear: number | null;
  competitionGoals: CompetitionGoalsMap | null;
  trainingHistory: TrainingHistoryData | null;
  strengthNumbers: StrengthNumbersData | null;
  technicalProfile: TechnicalProfileData | null;
  movementRestrictions: MovementRestrictionsData | null;
  email: string;
};

/* ─── Section 2: Competition & Distance Bands ───────────────────────── */

export type CompetitionMark = {
  distance: number;
  date: string;
  meet: string;
};

export type CompetitionGoalsEntry = {
  competitionPR: CompetitionMark;
  seasonBest: CompetitionMark;
  seasonGoal: number;
  careerGoal: number;
  targetBand: string;
};

export type CompetitionGoalsMap = Record<string, CompetitionGoalsEntry>;

/* ─── Section: Training History ─────────────────────────────────────── */

// `version` lets the shape evolve forward (e.g. v2 may break `prePR` into
// per-implement rows). Parsers default missing/legacy rows to v1.
// `prePR` is keyed by EventType ("SHOT_PUT" | "DISCUS" | "HAMMER" | "JAVELIN")
// → distance in meters, with the competition implement implied by the event +
// athlete gender. Pre-app PRs typically don't have catalog entries, so the
// catalog-keyed AthleteImplementPR table is not the right home for this.
export type TrainingHistoryData = {
  version: 1;
  yearsTraining: number | null;
  weeklyVolumeHours: number | null;
  priorCoaches: string;
  notableCompetitions: string;
  prePR: Record<string, number | null>;
};

/* ─── Section 4: Strength Numbers ───────────────────────────────────── */

export type LiftEntry = {
  current: number;
  date: string;
  goal: number;
  correlation: string;
};

export type StrengthNumbersData = {
  lifts: Record<string, LiftEntry>;
  tests: { standingLJ: number; tripleJump: number };
  ratios: { squatBW: number; cleanBW: number; snatchBW: number };
};

/* ─── Section 5: Technical Profile ──────────────────────────────────── */

export type TechnicalCue = {
  phase: string;
  cue: string;
  why: string;
};

export type TechnicalCueFail = {
  cue: string;
  why: string;
};

export type TechnicalProfileData = {
  primaryLimiter: string;
  strengths: string[];
  weaknesses: string[];
  cuesWork: TechnicalCue[];
  cuesFail: TechnicalCueFail[];
};

/* ─── Section 6: Movement Restrictions ──────────────────────────────── */

export type MovementRestrictionsData = {
  fullOverhead: boolean;
  fullHipRotation: boolean;
  deepSquat: boolean;
  singleLegStability: boolean;
  notes: string;
};

/* ─── ThrowsPR (from Prisma) ────────────────────────────────────────── */

export type ThrowsPRRecord = {
  id: string;
  event: string;
  implement: string;
  distance: number;
  achievedAt: string;
  source: string | null;
};

/* ─── ThrowsInjury (from Prisma) ────────────────────────────────────── */

export type ThrowsInjuryRecord = {
  id: string;
  injuryDate: string;
  returnToThrowDate: string | null;
  fullReturnDate: string | null;
  bodyPart: string;
  side: string | null;
  severity: string;
  type: string | null;
  throwsBanned: boolean;
  heavyBanned: boolean;
  strengthBanned: boolean;
  modifiedLoad: boolean;
  description: string | null;
  treatmentPlan: string | null;
  recovered: boolean;
  recoveredDate: string | null;
};

/* ─── ThrowsProfile (per-event enrollment) ──────────────────────────── */

export type ThrowsProfileSummary = {
  event: string;
  competitionPb: number | null;
  currentDistanceBand: string | null;
};

/* ─── Constants ─────────────────────────────────────────────────────── */

export const LIFTS = [
  { key: "backSquat", label: "Back Squat" },
  { key: "frontSquat", label: "Front Squat" },
  { key: "snatch", label: "Snatch" },
  { key: "powerClean", label: "Power Clean" },
  { key: "benchPress", label: "Bench Press" },
] as const;

export const CLASS_STANDINGS = [
  { value: "FR", label: "FR" },
  { value: "SO", label: "SO" },
  { value: "JR", label: "JR" },
  { value: "SR", label: "SR" },
  { value: "GRAD", label: "Grad" },
  { value: "PRO", label: "Pro" },
] as const;

export const EVENTS_LIST = [
  { value: "SHOT_PUT", label: "Shot Put" },
  { value: "DISCUS", label: "Discus" },
  { value: "HAMMER", label: "Hammer" },
  { value: "JAVELIN", label: "Javelin" },
] as const;

export const GENDERS_LIST = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

/* ─── Defensive JSON parsers ────────────────────────────────────────── */

/**
 * Runtime shape guards for profile JSON blobs. Prisma types these as
 * `Prisma.JsonValue` — any cast would pass, so legacy or malformed rows
 * could crash tabs on first render. Each parser returns a safe default
 * for the missing or malformed shape.
 */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function safeCompetitionGoals(raw: unknown): CompetitionGoalsMap | null {
  if (!isObject(raw)) return null;
  return raw as CompetitionGoalsMap;
}

export function safeTrainingHistory(raw: unknown): TrainingHistoryData | null {
  if (!isObject(raw)) return null;
  const prePRRaw = isObject(raw.prePR) ? raw.prePR : {};
  const prePR: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(prePRRaw)) {
    if (value == null) {
      prePR[key] = null;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      prePR[key] = value;
    }
  }
  return {
    version: 1,
    yearsTraining:
      typeof raw.yearsTraining === "number" && Number.isFinite(raw.yearsTraining)
        ? raw.yearsTraining
        : null,
    weeklyVolumeHours:
      typeof raw.weeklyVolumeHours === "number" && Number.isFinite(raw.weeklyVolumeHours)
        ? raw.weeklyVolumeHours
        : null,
    priorCoaches: typeof raw.priorCoaches === "string" ? raw.priorCoaches : "",
    notableCompetitions: typeof raw.notableCompetitions === "string" ? raw.notableCompetitions : "",
    prePR,
  };
}

export function safeStrengthNumbers(raw: unknown): StrengthNumbersData | null {
  if (!isObject(raw)) return null;
  return {
    lifts: isObject(raw.lifts) ? (raw.lifts as StrengthNumbersData["lifts"]) : {},
    tests: isObject(raw.tests)
      ? (raw.tests as StrengthNumbersData["tests"])
      : { standingLJ: 0, tripleJump: 0 },
    ratios: isObject(raw.ratios)
      ? (raw.ratios as StrengthNumbersData["ratios"])
      : { squatBW: 0, cleanBW: 0, snatchBW: 0 },
  };
}

export function safeTechnicalProfile(raw: unknown): TechnicalProfileData | null {
  if (!isObject(raw)) return null;
  return {
    primaryLimiter: typeof raw.primaryLimiter === "string" ? raw.primaryLimiter : "",
    strengths: Array.isArray(raw.strengths)
      ? raw.strengths.filter((s): s is string => typeof s === "string")
      : [],
    weaknesses: Array.isArray(raw.weaknesses)
      ? raw.weaknesses.filter((s): s is string => typeof s === "string")
      : [],
    cuesWork: Array.isArray(raw.cuesWork) ? (raw.cuesWork as TechnicalProfileData["cuesWork"]) : [],
    cuesFail: Array.isArray(raw.cuesFail) ? (raw.cuesFail as TechnicalProfileData["cuesFail"]) : [],
  };
}

export function safeMovementRestrictions(raw: unknown): MovementRestrictionsData | null {
  if (!isObject(raw)) return null;
  return {
    fullOverhead: typeof raw.fullOverhead === "boolean" ? raw.fullOverhead : false,
    fullHipRotation: typeof raw.fullHipRotation === "boolean" ? raw.fullHipRotation : false,
    deepSquat: typeof raw.deepSquat === "boolean" ? raw.deepSquat : false,
    singleLegStability:
      typeof raw.singleLegStability === "boolean" ? raw.singleLegStability : false,
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}
