// Session-detail derivation. Pure data shaping — no Prisma calls, no React.
//
// Given the loaded TrainingSession (with WorkoutPlan blocks + exercises) and
// the athlete's ThrowLogs/SessionLogs for that session, produces the DTO the
// athlete-side Session Detail screen renders.
//
// Bondarchuk enforcement: implements within a throwing block must descend.
// We sort and validate via the existing primitive (lib/bondarchuk/sequencing).
// On ascending input we still render — the block is flagged invalid so the UI
// can warn — and in non-production we throw to fail loudly during development.

import { validateImplementSequence } from "@/lib/bondarchuk/sequencing";

export type BlockKind = "throwing" | "strength" | "warmup" | "cooldown" | "other";
export type BlockStatus = "complete" | "active" | "locked";

export type ImplementChip = {
  weightKg: number;
  prescribed: number;
  completed: number;
  done: boolean;
  isCurrent: boolean;
};

export type ThrowHistoryEntry = {
  id: string;
  number: number;
  distance: number | null;
  rpe: number | null;
  implementKg: number;
  isPersonalBest: boolean;
  loggedAt: string;
};

export type SessionBlock = {
  id: string;
  order: number;
  kind: BlockKind;
  name: string;
  badge: string;
  status: BlockStatus;
  prescribedThrows: number;
  completedThrows: number;
  implements: ImplementChip[];
  history: ThrowHistoryEntry[];
  summary: string | null;
  invalidAscending: boolean;
};

export type PrescriptionToken =
  | { kind: "text"; value: string }
  | { kind: "implement"; value: string };

export type SessionDetailDTO = {
  id: string;
  athleteId: string;
  scheduledISO: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  eventLabel: string;
  headline: string;
  prescription: PrescriptionToken[];
  weekLabel: string | null;
  blocks: SessionBlock[];
  totalBlocks: number;
  completedBlocks: number;
};

// ── Inputs (Prisma-shaped, kept narrow so this file has zero Prisma coupling) ─

export type LoadedThrowLog = {
  id: string;
  event: string;
  implementWeight: number;
  distance: number | null;
  rpe: number | null;
  isPersonalBest: boolean;
  date: Date;
  attemptNumber: number | null;
};

export type LoadedSessionLog = {
  id: string;
  exerciseName: string;
  sets: number;
  completedAt: Date;
};

export type LoadedBlockExercise = {
  id: string;
  order: number;
  sets: number | null;
  reps: string | null;
  weight: string | null;
  distance: string | null;
  notes: string | null;
  implementKg: number | null;
  exercise: {
    id: string;
    name: string;
    category: string;
    event: string | null;
  };
};

export type LoadedWorkoutBlock = {
  id: string;
  order: number;
  name: string;
  blockType: string;
  notes: string | null;
  exercises: LoadedBlockExercise[];
};

export type LoadedSession = {
  id: string;
  athleteId: string;
  scheduledDate: Date;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  notes: string | null;
  plan: {
    id: string;
    name: string;
    description: string | null;
    event: string | null;
    phase: string | null;
    blocks: LoadedWorkoutBlock[];
  } | null;
  throwLogs: LoadedThrowLog[];
  logs: LoadedSessionLog[];
};

// ── Public API ───────────────────────────────────────────────────────────────

export function deriveSessionDetail(loaded: LoadedSession): SessionDetailDTO {
  const blocksRaw = loaded.plan?.blocks ?? [];
  const sortedBlocks = [...blocksRaw].sort((a, b) => a.order - b.order);

  const blocks: SessionBlock[] = sortedBlocks.map((block, i) =>
    deriveBlock(block, i, loaded.throwLogs, loaded.logs)
  );

  // Determine status across the timeline: lowest-order non-complete = active.
  let foundActive = false;
  for (const b of blocks) {
    if (b.status === "complete") continue;
    if (!foundActive) {
      b.status = "active";
      foundActive = true;
    } else {
      b.status = "locked";
    }
  }

  // If everything is complete, the session is done. UI can react to that.
  const completedBlocks = blocks.filter((b) => b.status === "complete").length;

  // Mark the current implement on the active block. Heaviest non-complete chip.
  const activeBlock = blocks.find((b) => b.status === "active");
  if (activeBlock) {
    const firstUndone = activeBlock.implements.find((c) => !c.done);
    if (firstUndone) firstUndone.isCurrent = true;
  }

  const eventLabel = buildEventLabel(loaded);
  const headline = buildHeadline(loaded);
  const prescription = buildPrescription(loaded, blocks);
  const weekLabel = buildWeekLabel(loaded);

  return {
    id: loaded.id,
    athleteId: loaded.athleteId,
    scheduledISO: loaded.scheduledDate.toISOString(),
    status: loaded.status,
    eventLabel,
    headline,
    prescription,
    weekLabel,
    blocks,
    totalBlocks: blocks.length,
    completedBlocks,
  };
}

// ── Block derivation ─────────────────────────────────────────────────────────

function deriveBlock(
  block: LoadedWorkoutBlock,
  index: number,
  throwLogs: ReadonlyArray<LoadedThrowLog>,
  sessionLogs: ReadonlyArray<LoadedSessionLog>
): SessionBlock {
  const kind = mapBlockKind(block.blockType);
  const isThrowing = kind === "throwing";

  const sortedExercises = [...block.exercises].sort((a, b) => a.order - b.order);

  // Validate implement order using the existing Bondarchuk primitive.
  const seq = validateImplementSequence(
    sortedExercises.map((e) => ({
      implementWeightKg: e.implementKg ?? null,
      orderIndex: e.order,
    }))
  );
  const invalidAscending = !seq.ok;
  if (invalidAscending && process.env.NODE_ENV !== "production") {
    throw new Error(
      `Bondarchuk violation in block "${block.name}": ${seq.ok ? "" : seq.violation}`
    );
  }

  // Build implement chips (throwing blocks only). Aggregate prescribed sets per
  // implement weight, then count completions from throwLogs (matched by weight).
  // Render order: descending weight, the destination of every Bondarchuk-correct
  // sequence — so we don't trust input order if the data is malformed.
  const prescribedByImpl = new Map<number, number>();
  for (const ex of sortedExercises) {
    if (ex.implementKg == null) continue;
    if (!isThrowing) continue;
    const sets = ex.sets ?? 0;
    prescribedByImpl.set(ex.implementKg, (prescribedByImpl.get(ex.implementKg) ?? 0) + sets);
  }

  const completedByImpl = new Map<number, number>();
  for (const t of throwLogs) {
    completedByImpl.set(t.implementWeight, (completedByImpl.get(t.implementWeight) ?? 0) + 1);
  }

  const implements_: ImplementChip[] = Array.from(prescribedByImpl.entries())
    .map(([weightKg, prescribed]) => {
      const completed = Math.min(completedByImpl.get(weightKg) ?? 0, prescribed);
      return {
        weightKg,
        prescribed,
        completed,
        done: completed >= prescribed,
        isCurrent: false,
      };
    })
    .sort((a, b) => b.weightKg - a.weightKg);

  const prescribedThrows = isThrowing
    ? Array.from(prescribedByImpl.values()).reduce((sum, n) => sum + n, 0)
    : 0;

  // Throws history for this block: only logs that match an implement in this
  // block. Numbered globally per implement (1, 2, 3 of N).
  const blockImplWeights = new Set(implements_.map((c) => c.weightKg));
  const blockThrows = throwLogs
    .filter((t) => blockImplWeights.has(t.implementWeight))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Number throws within their implement so the UI can show "01 / 02 / 03".
  const counterByImpl = new Map<number, number>();
  const history: ThrowHistoryEntry[] = blockThrows.map((t) => {
    const next = (counterByImpl.get(t.implementWeight) ?? 0) + 1;
    counterByImpl.set(t.implementWeight, next);
    return {
      id: t.id,
      number: next,
      distance: t.distance,
      rpe: t.rpe,
      implementKg: t.implementWeight,
      isPersonalBest: t.isPersonalBest,
      loggedAt: t.date.toISOString(),
    };
  });

  const completedThrows = isThrowing
    ? Array.from(completedByImpl.entries())
        .filter(([w]) => blockImplWeights.has(w))
        .reduce((sum, [w, n]) => {
          const cap = prescribedByImpl.get(w) ?? 0;
          return sum + Math.min(n, cap);
        }, 0)
    : 0;

  // Strength/warmup/cooldown completion: every prescribed exercise has at least
  // one matching SessionLog by name. Throwing blocks ignore SessionLogs — the
  // throw count is the truth.
  const completedNames = new Set(sessionLogs.map((l) => l.exerciseName.trim().toLowerCase()));
  const isComplete = isThrowing
    ? prescribedThrows > 0 && completedThrows >= prescribedThrows
    : sortedExercises.every((ex) => completedNames.has(ex.exercise.name.trim().toLowerCase()));

  const status: BlockStatus = isComplete ? "complete" : "locked"; // resolved later

  const badge = `BLOCK ${index + 1} · ${displayBlockKind(kind, isComplete)}`;
  const summary = isThrowing ? null : buildStrengthSummary(sortedExercises);

  return {
    id: block.id,
    order: block.order,
    kind,
    name: block.name,
    badge,
    status,
    prescribedThrows,
    completedThrows,
    implements: implements_,
    history,
    summary,
    invalidAscending,
  };
}

// ── Display helpers ──────────────────────────────────────────────────────────

function mapBlockKind(blockType: string): BlockKind {
  const t = blockType.trim().toLowerCase();
  if (t === "throwing" || t === "throw") return "throwing";
  if (t === "strength" || t === "lift") return "strength";
  if (t === "warmup" || t === "warm-up") return "warmup";
  if (t === "cooldown" || t === "cool-down") return "cooldown";
  return "other";
}

function displayBlockKind(kind: BlockKind, isComplete: boolean): string {
  if (isComplete) return kind === "throwing" ? "THROWING · DONE" : "STRENGTH · DONE";
  switch (kind) {
    case "throwing":
      return "THROWING";
    case "strength":
      return "STRENGTH";
    case "warmup":
      return "WARMUP";
    case "cooldown":
      return "COOLDOWN";
    default:
      return "BLOCK";
  }
}

function buildStrengthSummary(exercises: ReadonlyArray<LoadedBlockExercise>): string {
  if (exercises.length === 0) return "—";
  if (exercises.length === 1) {
    const ex = exercises[0];
    const rest = ex.notes?.match(/(\d+)\s*min/i)?.[0];
    return rest ? `${ex.exercise.name} · ${rest}` : ex.exercise.name;
  }
  return `${exercises[0].exercise.name} +${exercises.length - 1} more`;
}

function buildEventLabel(loaded: LoadedSession): string {
  const event = loaded.plan?.event;
  const phase = loaded.plan?.phase;
  if (event && phase) return `${event} · ${phase.replace(/_/g, " ")}`;
  if (event) return String(event);
  return "TRAINING SESSION";
}

function buildHeadline(loaded: LoadedSession): string {
  if (loaded.plan?.name) return loaded.plan.name;
  return "Today's session.";
}

function buildPrescription(
  loaded: LoadedSession,
  blocks: ReadonlyArray<SessionBlock>
): PrescriptionToken[] {
  if (loaded.plan?.description?.trim()) {
    return tokenizeDescription(loaded.plan.description);
  }

  // Fall back to a synthesized one-liner from the blocks.
  const tokens: PrescriptionToken[] = [];
  blocks.forEach((b, i) => {
    if (i > 0)
      tokens.push({ kind: "text", value: i === blocks.length - 1 ? ", finish on " : " → " });
    if (b.kind === "throwing" && b.implements.length > 0) {
      const chip = b.implements.map((c) => `${c.prescribed} × ${formatKg(c.weightKg)}`).join(" → ");
      tokens.push({ kind: "implement", value: chip });
    } else {
      tokens.push({ kind: "text", value: b.name.toLowerCase() });
    }
  });
  if (tokens.length === 0) tokens.push({ kind: "text", value: "No plan attached." });
  return tokens;
}

function tokenizeDescription(desc: string): PrescriptionToken[] {
  // Treat tokens like "5 × 9kg", "25 min", "7.26kg" as implement chips. Everything
  // else is plain prose. We're intentionally light-touch: a regex that catches the
  // shapes coaches actually write, not a full parser.
  const re =
    /(\d+(?:\.\d+)?\s*(?:×|x)\s*\d+(?:\.\d+)?\s*(?:kg|lbs?))|(\d+(?:\.\d+)?\s*(?:kg|lbs?|min|m))/gi;
  const tokens: PrescriptionToken[] = [];
  let lastIndex = 0;
  for (const m of desc.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > lastIndex) tokens.push({ kind: "text", value: desc.slice(lastIndex, idx) });
    tokens.push({ kind: "implement", value: m[0].replace(/\s+/g, " ").trim() });
    lastIndex = idx + m[0].length;
  }
  if (lastIndex < desc.length) tokens.push({ kind: "text", value: desc.slice(lastIndex) });
  return tokens.length > 0 ? tokens : [{ kind: "text", value: desc }];
}

function buildWeekLabel(loaded: LoadedSession): string | null {
  const phase = loaded.plan?.phase;
  if (!phase) return null;
  return phase.replace(/_/g, " ");
}

function formatKg(kg: number): string {
  // 7.26 → "7.26kg", 9 → "9kg" — drop trailing zeros without forcing decimals.
  const s = Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${s}kg`;
}
