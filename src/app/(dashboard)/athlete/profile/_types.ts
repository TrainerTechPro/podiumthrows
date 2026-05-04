// Types shared across all profile tab components

import type { EventType, Gender } from "@prisma/client";
import { logger } from "@/lib/logger";

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
  lifestyle: LifestyleData | null;
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

/* ─── Section: Lifestyle ────────────────────────────────────────────── */

// Sensitive — coach reads must go through requireCoachAthlete relationship
// check (no org-wide queries). `recoveryPractices` is a string[] of stable
// keys from RECOVERY_PRACTICE_OPTIONS so vocabulary changes don't lose data
// (unknown keys round-trip but render as "Other").
export type LifestyleData = {
  version: 1;
  sleepHours: number | null;
  schoolWorkHours: number | null;
  stressBaseline: number | null;
  nutritionSetup: string;
  recoveryPractices: string[];
};

export const RECOVERY_PRACTICE_OPTIONS = [
  { key: "MASSAGE", label: "Massage" },
  { key: "FOAM_ROLLING", label: "Foam rolling" },
  { key: "STRETCHING", label: "Stretching / mobility" },
  { key: "SAUNA", label: "Sauna" },
  { key: "COLD_PLUNGE", label: "Cold plunge / contrast" },
  { key: "COMPRESSION", label: "Compression boots" },
  { key: "CHIRO_PT", label: "Chiro / PT" },
  { key: "MEDITATION", label: "Meditation / breathwork" },
] as const;

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

/* ─── Section: Equipment Access ─────────────────────────────────────── */

// Mirrors the EquipmentInventory model — a relational table that already
// exists and feeds the program engine. The Master Profile v2 plan called
// this "NO HOME" but the table predated the plan; we extend it with
// `facility` + `weightRoomAccess` rather than adding a duplicate JSON column.

export type ImplementType = "shot" | "disc" | "hammer" | "jav" | "weight";

export type ImplementEntry = {
  weightKg: number;
  type: ImplementType;
};

export type WeightRoomAccess = "FULL" | "LIMITED" | "NONE";

export type EquipmentData = {
  implements: ImplementEntry[];
  hasCage: boolean;
  hasRing: boolean;
  hasFieldAccess: boolean;
  hasGym: boolean;
  // Round-tripped opaque — engine and onboard wizard write different shapes
  // (string[] vs object). The profile tab does not edit this field.
  gymEquipment: unknown;
  facility: string | null;
  weightRoomAccess: WeightRoomAccess | null;
};

// Maps the 4 standard EventType values to the legacy implement type code
// the EquipmentInventory model + program engine already use.
export const EVENT_TO_IMPLEMENT_TYPE: Record<string, ImplementType> = {
  SHOT_PUT: "shot",
  DISCUS: "disc",
  HAMMER: "hammer",
  JAVELIN: "jav",
};

// Common training weights per event type (kg). Athletes pick what they own;
// custom weights live in the equipment-inventory wizard for now.
export const STANDARD_IMPLEMENT_WEIGHTS: Record<ImplementType, number[]> = {
  shot: [3, 4, 5, 6, 7.26, 8, 9, 10],
  disc: [0.75, 1, 1.5, 1.6, 1.75, 2, 2.5],
  hammer: [4, 5, 6, 7.26, 8, 9, 10, 11.34, 12, 16],
  jav: [0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  // weight throw — no preset; preserved on round-trip but not edited here.
  weight: [],
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

export function safeLifestyle(raw: unknown): LifestyleData | null {
  if (!isObject(raw)) return null;
  return {
    version: 1,
    sleepHours:
      typeof raw.sleepHours === "number" && Number.isFinite(raw.sleepHours) ? raw.sleepHours : null,
    schoolWorkHours:
      typeof raw.schoolWorkHours === "number" && Number.isFinite(raw.schoolWorkHours)
        ? raw.schoolWorkHours
        : null,
    stressBaseline:
      typeof raw.stressBaseline === "number" && Number.isFinite(raw.stressBaseline)
        ? raw.stressBaseline
        : null,
    nutritionSetup: typeof raw.nutritionSetup === "string" ? raw.nutritionSetup : "",
    recoveryPractices: Array.isArray(raw.recoveryPractices)
      ? raw.recoveryPractices.filter((s): s is string => typeof s === "string")
      : [],
  };
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

// `row` is a Prisma EquipmentInventory row or null. Implements/gymEquipment
// are JSON-serialized strings on the row — parse leniently so corrupted rows
// surface as defaults instead of crashing the page render.
export function safeEquipment(
  row: {
    implements: string;
    hasCage: boolean;
    hasRing: boolean;
    hasFieldAccess: boolean;
    hasGym: boolean;
    gymEquipment: string | null;
    facility: string | null;
    weightRoomAccess: string | null;
  } | null
): EquipmentData {
  if (!row) {
    return {
      implements: [],
      hasCage: true,
      hasRing: true,
      hasFieldAccess: true,
      hasGym: true,
      gymEquipment: null,
      facility: null,
      weightRoomAccess: null,
    };
  }

  let implementsArr: ImplementEntry[] = [];
  try {
    const parsed = JSON.parse(row.implements || "[]");
    if (Array.isArray(parsed)) {
      implementsArr = parsed.filter(
        (e): e is ImplementEntry =>
          isObject(e) &&
          typeof e.weightKg === "number" &&
          Number.isFinite(e.weightKg) &&
          typeof e.type === "string"
      );
    }
  } catch (err) {
    logger.warn("safeEquipment: implements JSON parse failed", {
      context: "athlete/profile/types",
      error: err,
    });
  }

  let gymEquipment: unknown = null;
  if (row.gymEquipment) {
    try {
      gymEquipment = JSON.parse(row.gymEquipment);
    } catch (err) {
      logger.warn("safeEquipment: gymEquipment JSON parse failed", {
        context: "athlete/profile/types",
        error: err,
      });
    }
  }

  const wra = row.weightRoomAccess;
  const weightRoomAccess: WeightRoomAccess | null =
    wra === "FULL" || wra === "LIMITED" || wra === "NONE" ? wra : null;

  return {
    implements: implementsArr,
    hasCage: row.hasCage,
    hasRing: row.hasRing,
    hasFieldAccess: row.hasFieldAccess,
    hasGym: row.hasGym,
    gymEquipment,
    facility: row.facility,
    weightRoomAccess,
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
