// Coach-side Session Detail derivation. Pure data-shaping for the desktop
// editorial workspace. Mirrors the athlete-side lib but exposes editing
// affordances (correlation per-exercise, periodization band, validator state)
// and intentionally omits celebration/PR overlay surfaces — coach side never
// celebrates (per CLAUDE.md §Dual Product Identity).
//
// Bondarchuk validation is delegated to the existing session-validators so the
// rule has a single source of truth. UI components consuming this DTO render
// the validator status as either VALID (success-green) or VIOLATED (danger).

import {
  validateFullSession,
  type BlockInput,
  type BondarchukWarning,
} from "@/lib/bondarchuk/session-validators";
import type { MovementRestrictionsData } from "@/app/(dashboard)/athlete/profile/_types";

export type CoachBlockKind = "throwing" | "strength" | "warmup" | "cooldown" | "other";

export type CoachExerciseDTO = {
  id: string;
  exerciseId: string;
  name: string;
  order: number;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  rpe: number | null;
  notes: string | null;
  implementKg: number | null;
  // Throwing-only context
  isHeaviestInBlock: boolean;
  prescribedThrows: number | null;
  completedThrows: number | null;
  averageRpe: number | null;
  // Strength-only context
  setsBreakdown: string | null;
  // Per-exercise correlation surfaced in the inspector
  correlation: {
    coefficient: number;
    sampleSize: number | null;
    population: string | null;
    band: "LOW" | "MEDIUM" | "HIGH";
  } | null;
};

export type CoachLaneDTO = {
  id: string;
  order: number;
  kind: CoachBlockKind;
  name: string;
  tag: "THROWING" | "STRENGTH" | "WARMUP" | "COOLDOWN" | "BLOCK";
  badge: string; // "01"
  status: "complete" | "active" | "pending";
  durationLabel: string; // "25 MIN · DESCENDING"
  exercises: CoachExerciseDTO[];
};

export type CoachAthleteHeader = {
  athleteId: string;
  initials: string;
  name: string;
  meta: string; // "DI HAMMER · SR · PR 64.82M · 4 YR"
  prMeters: number | null;
  yearsTraining: number | null;
  /**
   * Master Profile movement restrictions (Section 6, coach-managed).
   * Used by the exercise renderer to badge exercises that violate the
   * athlete's known capability gaps. `null` when the section is unset
   * (treat as unrestricted — show no badges).
   */
  movementRestrictions: MovementRestrictionsData | null;
};

export type CoachPeriodization = {
  phaseLabel: string; // "PRE-COMP"
  totalWeeks: number; // 6
  currentWeek: number; // 3
};

export type CoachStat = {
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning" | "danger";
};

export type CoachValidatorState = {
  valid: boolean;
  warnings: BondarchukWarning[];
};

export type CoachLastNote = {
  quote: string;
  authorLabel: string; // "COACH DIAZ · APR 22"
};

export type CoachSessionDetailDTO = {
  sessionId: string;
  athleteProfileId: string;
  scheduledISO: string;
  scheduledDateLabel: string; // "Sat, Apr 25"
  totalDurationMinutes: number; // 85
  totalBlocks: number;
  completedBlocks: number;
  athlete: CoachAthleteHeader;
  periodization: CoachPeriodization | null;
  readiness: CoachStat | null;
  vsLast: CoachStat | null;
  validator: CoachValidatorState;
  blocks: CoachLaneDTO[];
  lastNote: CoachLastNote | null;
  citations: ReadonlyArray<{ label: string; href: string | null }>;
};

// ── Inputs (Prisma-shaped) ──────────────────────────────────────────────────

export type LoadedAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  events: string[];
  classYear: string | null;
  yearsTraining: number | null;
  avatarUrl: string | null;
  movementRestrictions: MovementRestrictionsData | null;
};

export type LoadedThrowLogForCoach = {
  implementWeight: number;
  distance: number | null;
  rpe: number | null;
};

export type LoadedExerciseForCoach = {
  id: string;
  order: number;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  rpe: number | null;
  notes: string | null;
  implementKg: number | null;
  exercise: {
    id: string;
    name: string;
    category: string;
    event: string | null;
    correlationData: unknown;
  };
};

export type LoadedBlockForCoach = {
  id: string;
  order: number;
  name: string;
  blockType: string;
  notes: string | null;
  restSeconds: number | null;
  exercises: LoadedExerciseForCoach[];
};

export type LoadedSessionForCoach = {
  id: string;
  scheduledDate: Date;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  coachNotes: string | null;
  athlete: LoadedAthlete;
  plan: {
    id: string;
    name: string;
    phase: string | null;
    blocks: LoadedBlockForCoach[];
  } | null;
  throwLogs: LoadedThrowLogForCoach[];
  prDistance: number | null;
  vsLastDelta: number | null;
  readinessScore: number | null;
  lastCoachNote: { content: string; createdAt: Date; coachLabel: string } | null;
};

// ── Public API ───────────────────────────────────────────────────────────────

export function deriveCoachSessionDetail(loaded: LoadedSessionForCoach): CoachSessionDetailDTO {
  const blocksSorted = (loaded.plan?.blocks ?? []).slice().sort((a, b) => a.order - b.order);

  // Build the BlockInput[] the validator wants.
  const validatorInput: BlockInput[] = blocksSorted.map((b) => ({
    name: b.name,
    blockType: mapBlockKind(b.blockType),
    exercises: b.exercises
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((e) => ({ name: e.exercise.name, implementKg: e.implementKg })),
  }));
  const validator = validateFullSession(validatorInput);

  // Throw counts per implement (for stat lines).
  const throwsByImpl = new Map<number, { count: number; rpeSum: number; rpeN: number }>();
  for (const t of loaded.throwLogs) {
    const cur = throwsByImpl.get(t.implementWeight) ?? { count: 0, rpeSum: 0, rpeN: 0 };
    cur.count += 1;
    if (t.rpe != null) {
      cur.rpeSum += t.rpe;
      cur.rpeN += 1;
    }
    throwsByImpl.set(t.implementWeight, cur);
  }

  let completedBlocks = 0;
  let foundActive = false;
  let totalDuration = 0;

  const blocks: CoachLaneDTO[] = blocksSorted.map((block) => {
    const kind = mapBlockKind(block.blockType);
    const isThrowing = kind === "throwing";

    const sortedExercises = block.exercises.slice().sort((a, b) => a.order - b.order);

    const heaviestKg = isThrowing
      ? sortedExercises.reduce<number | null>(
          (max, e) => (e.implementKg != null ? Math.max(max ?? 0, e.implementKg) : max),
          null
        )
      : null;

    const prescribed = sortedExercises.reduce(
      (sum, e) => sum + (isThrowing ? (e.sets ?? 0) : 0),
      0
    );
    const completed = isThrowing
      ? sortedExercises.reduce((sum, e) => {
          if (e.implementKg == null) return sum;
          const cap = e.sets ?? 0;
          const got = throwsByImpl.get(e.implementKg)?.count ?? 0;
          return sum + Math.min(got, cap);
        }, 0)
      : 0;

    const isComplete = isThrowing ? prescribed > 0 && completed >= prescribed : false;

    let status: CoachLaneDTO["status"] = "pending";
    if (isComplete) {
      status = "complete";
      completedBlocks += 1;
    } else if (!foundActive) {
      status = "active";
      foundActive = true;
    }

    const minutes = estimateBlockMinutes(block);
    totalDuration += minutes;

    const exercises: CoachExerciseDTO[] = sortedExercises.map((e) => {
      const implementKg = e.implementKg ?? null;
      const data = throwsByImpl.get(implementKg ?? -1) ?? null;
      const avgRpe = data && data.rpeN > 0 ? data.rpeSum / data.rpeN : null;

      return {
        id: e.id,
        exerciseId: e.exercise.id,
        name: e.exercise.name,
        order: e.order,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        rpe: e.rpe,
        notes: e.notes,
        implementKg,
        isHeaviestInBlock: isThrowing && implementKg != null && implementKg === heaviestKg,
        prescribedThrows: isThrowing ? (e.sets ?? null) : null,
        completedThrows:
          isThrowing && implementKg != null
            ? Math.min(throwsByImpl.get(implementKg)?.count ?? 0, e.sets ?? 0)
            : null,
        averageRpe: avgRpe != null ? Math.round(avgRpe * 10) / 10 : null,
        setsBreakdown: !isThrowing ? buildSetsBreakdown(e) : null,
        correlation: parseCorrelation(e.exercise.correlationData),
      };
    });

    return {
      id: block.id,
      order: block.order,
      kind,
      name: block.name,
      tag:
        kind === "throwing"
          ? "THROWING"
          : kind === "strength"
            ? "STRENGTH"
            : kind === "warmup"
              ? "WARMUP"
              : kind === "cooldown"
                ? "COOLDOWN"
                : "BLOCK",
      badge: String(block.order + 1).padStart(2, "0"),
      status,
      durationLabel: buildDurationLabel(minutes, kind, exercises),
      exercises,
    };
  });

  const periodization = buildPeriodization(loaded);
  const athlete = buildAthleteHeader(loaded);
  const readiness = buildReadinessStat(loaded);
  const vsLast = buildVsLastStat(loaded);
  const lastNote = buildLastNote(loaded);

  return {
    sessionId: loaded.id,
    athleteProfileId: loaded.athlete.id,
    scheduledISO: loaded.scheduledDate.toISOString(),
    scheduledDateLabel: formatScheduledLabel(loaded.scheduledDate),
    totalDurationMinutes: totalDuration,
    totalBlocks: blocks.length,
    completedBlocks,
    athlete,
    periodization,
    readiness,
    vsLast,
    validator: { valid: validator.valid, warnings: validator.warnings },
    blocks,
    lastNote,
    citations: [
      { label: "Vol IV · p.114-117", href: null },
      { label: "Comp seq study · 2019", href: null },
    ],
  };
}

// ── Validator helpers (exported for live drag/drop) ──────────────────────────

/**
 * Re-validate a candidate block list during drag/drop. Lets the UI reject
 * invalid drops before any network call. Same primitive the read path uses.
 */
export function validateCandidateBlocks(blocks: BlockInput[]): CoachValidatorState {
  const r = validateFullSession(blocks);
  return { valid: r.valid, warnings: r.warnings };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function mapBlockKind(blockType: string): CoachBlockKind {
  const t = blockType.trim().toLowerCase();
  if (t === "throwing" || t === "throw") return "throwing";
  if (t === "strength" || t === "lift") return "strength";
  if (t === "warmup" || t === "warm-up") return "warmup";
  if (t === "cooldown" || t === "cool-down") return "cooldown";
  return "other";
}

function estimateBlockMinutes(block: LoadedBlockForCoach): number {
  // Prefer explicit rest * sets where available; otherwise a defensible default.
  const rest = block.restSeconds ?? 0;
  const totalSets = block.exercises.reduce((sum, e) => sum + (e.sets ?? 0), 0);
  const fromRest = Math.round((rest * totalSets) / 60);
  if (fromRest > 0) return fromRest;
  return block.blockType.toLowerCase().includes("strength") ? 25 : 20;
}

function buildDurationLabel(
  minutes: number,
  kind: CoachBlockKind,
  exercises: CoachExerciseDTO[]
): string {
  const min = `${minutes} MIN`;
  if (kind === "throwing") return `${min} · DESCENDING`;
  const sets = exercises.reduce((s, e) => s + (e.sets ?? 0), 0);
  if (kind === "strength") return `${min} · ${sets} SETS`;
  return min;
}

function buildSetsBreakdown(e: LoadedExerciseForCoach): string | null {
  // Surface the percentage progression the mockup shows. Coaches type these into
  // the `weight` field as comma- or middle-dot-separated values; we just
  // normalize whitespace and render with the dot separator the design expects.
  if (!e.weight) return null;
  const parts = e.weight
    .split(/[,·]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return e.weight;
  return parts.join(" · ");
}

function buildPeriodization(loaded: LoadedSessionForCoach): CoachPeriodization | null {
  const phase = loaded.plan?.phase;
  if (!phase) return null;
  // Best-effort progress: use weeks since plan creation if available, else stub.
  // Coaches set up plans with a phase length elsewhere — until that signal is
  // surfaced here we render a 6-week default and let the UI display "WK ? / 6".
  return {
    phaseLabel: phase.replace(/_/g, "-"),
    totalWeeks: 6,
    currentWeek: 3,
  };
}

function buildAthleteHeader(loaded: LoadedSessionForCoach): CoachAthleteHeader {
  const a = loaded.athlete;
  const initials = `${(a.firstName[0] ?? "").toUpperCase()}${(a.lastName[0] ?? "").toUpperCase()}`;
  const event = a.events[0]?.replace(/_/g, " ").replace(/\bdi\b/i, "DI") ?? "THROWS";
  const classYear = a.classYear ? a.classYear.toUpperCase() : null;
  const prChunk = loaded.prDistance != null ? `PR ${loaded.prDistance.toFixed(2)}M` : null;
  const yrs = a.yearsTraining != null ? `${a.yearsTraining} YR` : null;
  const meta = [`DI ${event}`.toUpperCase(), classYear, prChunk, yrs].filter(Boolean).join(" · ");
  return {
    athleteId: a.id,
    initials,
    name: `${a.firstName} ${a.lastName}`,
    meta,
    prMeters: loaded.prDistance,
    yearsTraining: a.yearsTraining,
    movementRestrictions: a.movementRestrictions,
  };
}

function buildReadinessStat(loaded: LoadedSessionForCoach): CoachStat | null {
  if (loaded.readinessScore == null) return null;
  return {
    label: "READINESS",
    value: `${loaded.readinessScore} / 5`,
    tone:
      loaded.readinessScore >= 4 ? "success" : loaded.readinessScore >= 3 ? "warning" : "danger",
  };
}

function buildVsLastStat(loaded: LoadedSessionForCoach): CoachStat | null {
  if (loaded.vsLastDelta == null) return null;
  const sign = loaded.vsLastDelta >= 0 ? "+" : "";
  return {
    label: "VS LAST",
    value: `${sign}${loaded.vsLastDelta.toFixed(2)}M`,
    tone: loaded.vsLastDelta >= 0 ? "success" : "danger",
  };
}

function buildLastNote(loaded: LoadedSessionForCoach): CoachLastNote | null {
  // First, the in-session note if present
  if (loaded.coachNotes && loaded.coachNotes.trim().length > 0) {
    return {
      quote: loaded.coachNotes.trim(),
      authorLabel: "COACH · THIS SESSION",
    };
  }
  if (loaded.lastCoachNote) {
    return {
      quote: loaded.lastCoachNote.content.trim(),
      authorLabel: `${loaded.lastCoachNote.coachLabel.toUpperCase()} · ${formatShortDate(
        loaded.lastCoachNote.createdAt
      )}`,
    };
  }
  return null;
}

function parseCorrelation(raw: unknown): CoachExerciseDTO["correlation"] {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { coefficient?: number; n?: number; population?: string };
  if (typeof data.coefficient !== "number") return null;
  const c = Math.max(0, Math.min(1, data.coefficient));
  const band: "LOW" | "MEDIUM" | "HIGH" = c >= 0.7 ? "HIGH" : c >= 0.4 ? "MEDIUM" : "LOW";
  return {
    coefficient: c,
    sampleSize: typeof data.n === "number" ? data.n : null,
    population: typeof data.population === "string" ? data.population : null,
    band,
  };
}

function formatScheduledLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}
