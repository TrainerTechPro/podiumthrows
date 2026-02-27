// ── Session Tracking Reducer ─────────────────────────────────────────
// Consolidated state management for the in-session tracking experience.
// Replaces 10+ useState calls with a single reducer + computed helpers.

import { useReducer, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────

export interface ThrowBlock {
  implement: string;
  implementKg: number;
  category: string;
  drillType: string;
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  notes?: string;
}

export interface StrengthBlock {
  exerciseId: string;
  exerciseName: string;
  classification: string;
  sets: number;
  reps: number;
  intensityPercent?: number;
  loadKg?: number;
  restSeconds: number;
  notes?: string;
}

export interface WarmupBlock {
  name: string;
  duration?: number;
  notes?: string;
}

export interface ThrowResult {
  id: string;
  throwNumber: number;
  implement: string;
  distance: number | null;
  drillType: string | null;
  notes: string | null;
}

export interface LiftResult {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: number | null;
  rpe: number | null;
}

export interface BestMark {
  id: string;
  implement: string;
  distance: number;
  drillType: string | null;
}

export interface SessionDetail {
  id: string;
  programId: string;
  weekNumber: number;
  dayOfWeek: number;
  dayType: string;
  sessionType: string;
  focusLabel: string;
  totalThrowsTarget: number;
  estimatedDuration: number;
  status: string;
  throwsPrescription: ThrowBlock[];
  strengthPrescription: StrengthBlock[];
  warmupPrescription: WarmupBlock[];
  throwResults: ThrowResult[];
  liftResults: LiftResult[];
  bestMarks?: BestMark[];
  actualThrows: number | null;
  selfFeeling: string | null;
  rpe: number | null;
  bestMark: number | null;
  sessionNotes: string | null;
  wasModified?: boolean;
  modificationNotes?: string | null;
  actualPrescription?: unknown;
}

export interface ThrowEntry {
  distance: number;
  implement: string;
  drillType: string;
  throwNumber: number;
  synced: boolean; // false = optimistic, waiting for API
}

export interface LiftEntry {
  exerciseName: string;
  exerciseId: string;
  weight: number;
  reps: number;
  rpe?: number;
  setNumber: number;
  synced: boolean;
}

export type WorkflowPhase = "warmup" | "throws" | "strength" | "complete" | "summary";

// ── State ─────────────────────────────────────────────────────────────

export interface SessionState {
  session: SessionDetail | null;
  loading: boolean;
  error: string;

  // Workflow progression
  currentPhase: WorkflowPhase;
  currentBlockIndex: number;
  currentSetIndex: number;

  // Warmup tracking
  warmupChecked: Record<number, boolean>;

  // Throw tracking (local, synced to API)
  throwsByBlock: Record<number, ThrowEntry[]>;

  // Strength tracking
  liftsByBlock: Record<number, LiftEntry[]>;

  // Rest timer
  restActive: boolean;
  restSeconds: number;

  // Best marks per implement (auto-computed)
  bestMarks: Record<string, number>;

  // Completion form
  rpe: number;
  selfFeeling: string;
  sessionNotes: string;

  // Alternate session
  wasModified: boolean;
  modificationNotes: string;

  // UI flags
  showCompletionSheet: boolean;
  submitting: boolean;
}

// ── Actions ───────────────────────────────────────────────────────────

export type SessionAction =
  | { type: "SET_SESSION"; payload: SessionDetail }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_PHASE"; payload: WorkflowPhase }
  | { type: "SET_BLOCK_INDEX"; payload: number }
  | { type: "ADVANCE_BLOCK" }
  | { type: "ADVANCE_SET" }
  | { type: "TOGGLE_WARMUP"; payload: number }
  | { type: "LOG_THROW"; payload: { blockIndex: number; entry: ThrowEntry } }
  | { type: "MARK_THROW_SYNCED"; payload: { blockIndex: number; throwNumber: number } }
  | { type: "LOG_LIFT"; payload: { blockIndex: number; entry: LiftEntry } }
  | { type: "MARK_LIFT_SYNCED"; payload: { blockIndex: number; setNumber: number } }
  | { type: "START_REST"; payload: number }
  | { type: "REST_COMPLETE" }
  | { type: "SET_RPE"; payload: number }
  | { type: "SET_FEELING"; payload: string }
  | { type: "SET_NOTES"; payload: string }
  | { type: "TOGGLE_MODIFIED" }
  | { type: "SET_MODIFICATION_NOTES"; payload: string }
  | { type: "SHOW_COMPLETION_SHEET"; payload: boolean }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SESSION_COMPLETED" };

// ── Initial State ────────────────────────────────────────────────────

export const initialState: SessionState = {
  session: null,
  loading: true,
  error: "",
  currentPhase: "warmup",
  currentBlockIndex: 0,
  currentSetIndex: 0,
  warmupChecked: {},
  throwsByBlock: {},
  liftsByBlock: {},
  restActive: false,
  restSeconds: 0,
  bestMarks: {},
  rpe: 7,
  selfFeeling: "GOOD",
  sessionNotes: "",
  wasModified: false,
  modificationNotes: "",
  showCompletionSheet: false,
  submitting: false,
};

// ── Reducer ───────────────────────────────────────────────────────────

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "SET_SESSION": {
      const session = action.payload;
      const isCompleted = session.status === "COMPLETED";

      if (isCompleted) {
        return { ...state, session, loading: false, currentPhase: "summary" };
      }

      // Calculate resume position from existing throwResults
      const { blockIndex, setIndex, throwsByBlock, bestMarks } = calculateResumePosition(session);

      // Determine starting phase
      let startPhase: WorkflowPhase = "warmup";
      if (Object.keys(throwsByBlock).length > 0) {
        // Already has throws logged — resume in throws phase
        startPhase = "throws";
      } else if (session.warmupPrescription.length === 0) {
        startPhase = session.throwsPrescription.length > 0 ? "throws" : "strength";
      }

      // Rebuild lift data from existing liftResults
      const liftsByBlock: Record<number, LiftEntry[]> = {};
      if (session.liftResults.length > 0) {
        for (const lift of session.liftResults) {
          const bIdx = session.strengthPrescription.findIndex(
            (b) => b.exerciseId === lift.exerciseId || b.exerciseName === lift.exerciseName,
          );
          if (bIdx >= 0) {
            if (!liftsByBlock[bIdx]) liftsByBlock[bIdx] = [];
            liftsByBlock[bIdx].push({
              exerciseName: lift.exerciseName,
              exerciseId: lift.exerciseId,
              weight: lift.weight ?? 0,
              reps: lift.reps,
              rpe: lift.rpe ?? undefined,
              setNumber: liftsByBlock[bIdx].length + 1,
              synced: true,
            });
          }
        }
      }

      return {
        ...state,
        session,
        loading: false,
        currentPhase: startPhase,
        currentBlockIndex: blockIndex,
        currentSetIndex: setIndex,
        throwsByBlock,
        liftsByBlock,
        bestMarks,
      };
    }

    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };

    case "SET_PHASE":
      return { ...state, currentPhase: action.payload };

    case "SET_BLOCK_INDEX":
      return { ...state, currentBlockIndex: action.payload, currentSetIndex: 0 };

    case "ADVANCE_BLOCK": {
      const nextBlock = state.currentBlockIndex + 1;
      const totalBlocks = state.session?.throwsPrescription.length ?? 0;

      if (nextBlock >= totalBlocks) {
        // Done with throws — move to strength or complete
        const hasStrength = (state.session?.strengthPrescription.length ?? 0) > 0;
        return {
          ...state,
          currentPhase: hasStrength ? "strength" : "complete",
          currentBlockIndex: nextBlock,
          currentSetIndex: 0,
        };
      }

      return { ...state, currentBlockIndex: nextBlock, currentSetIndex: 0 };
    }

    case "ADVANCE_SET":
      return { ...state, currentSetIndex: state.currentSetIndex + 1, restActive: false };

    case "TOGGLE_WARMUP": {
      const idx = action.payload;
      const checked = { ...state.warmupChecked, [idx]: !state.warmupChecked[idx] };
      return { ...state, warmupChecked: checked };
    }

    case "LOG_THROW": {
      const { blockIndex, entry } = action.payload;
      const blockThrows = [...(state.throwsByBlock[blockIndex] ?? []), entry];
      const throwsByBlock = { ...state.throwsByBlock, [blockIndex]: blockThrows };

      // Update best marks
      const bestMarks = { ...state.bestMarks };
      const currentBest = bestMarks[entry.implement] ?? 0;
      if (entry.distance > currentBest) {
        bestMarks[entry.implement] = entry.distance;
      }

      return { ...state, throwsByBlock, bestMarks };
    }

    case "MARK_THROW_SYNCED": {
      const { blockIndex, throwNumber } = action.payload;
      const throws = (state.throwsByBlock[blockIndex] ?? []).map((t) =>
        t.throwNumber === throwNumber ? { ...t, synced: true } : t,
      );
      return { ...state, throwsByBlock: { ...state.throwsByBlock, [blockIndex]: throws } };
    }

    case "LOG_LIFT": {
      const { blockIndex, entry } = action.payload;
      const blockLifts = [...(state.liftsByBlock[blockIndex] ?? []), entry];
      return { ...state, liftsByBlock: { ...state.liftsByBlock, [blockIndex]: blockLifts } };
    }

    case "MARK_LIFT_SYNCED": {
      const { blockIndex, setNumber } = action.payload;
      const lifts = (state.liftsByBlock[blockIndex] ?? []).map((l) =>
        l.setNumber === setNumber ? { ...l, synced: true } : l,
      );
      return { ...state, liftsByBlock: { ...state.liftsByBlock, [blockIndex]: lifts } };
    }

    case "START_REST":
      return { ...state, restActive: true, restSeconds: action.payload };

    case "REST_COMPLETE":
      return { ...state, restActive: false, restSeconds: 0 };

    case "SET_RPE":
      return { ...state, rpe: action.payload };

    case "SET_FEELING":
      return { ...state, selfFeeling: action.payload };

    case "SET_NOTES":
      return { ...state, sessionNotes: action.payload };

    case "TOGGLE_MODIFIED":
      return { ...state, wasModified: !state.wasModified };

    case "SET_MODIFICATION_NOTES":
      return { ...state, modificationNotes: action.payload };

    case "SHOW_COMPLETION_SHEET":
      return { ...state, showCompletionSheet: action.payload };

    case "SET_SUBMITTING":
      return { ...state, submitting: action.payload };

    case "SESSION_COMPLETED":
      return { ...state, currentPhase: "summary", showCompletionSheet: false, submitting: false };

    default:
      return state;
  }
}

// ── Resume Position Calculator ────────────────────────────────────────

function calculateResumePosition(session: SessionDetail): {
  blockIndex: number;
  setIndex: number;
  throwsByBlock: Record<number, ThrowEntry[]>;
  bestMarks: Record<string, number>;
} {
  const throwsByBlock: Record<number, ThrowEntry[]> = {};
  const bestMarks: Record<string, number> = {};

  if (session.throwResults.length === 0) {
    return { blockIndex: 0, setIndex: 0, throwsByBlock, bestMarks };
  }

  // Group existing throw results by matching them to prescription blocks
  for (const result of session.throwResults) {
    // Find matching block by implement
    const blockIdx = session.throwsPrescription.findIndex(
      (b) => b.implement === result.implement,
    );
    const idx = blockIdx >= 0 ? blockIdx : 0;

    if (!throwsByBlock[idx]) throwsByBlock[idx] = [];
    throwsByBlock[idx].push({
      distance: result.distance ?? 0,
      implement: result.implement,
      drillType: result.drillType ?? "FULL_THROW",
      throwNumber: result.throwNumber,
      synced: true,
    });

    // Track best marks
    if (result.distance && result.distance > (bestMarks[result.implement] ?? 0)) {
      bestMarks[result.implement] = result.distance;
    }
  }

  // Find the first incomplete block
  let blockIndex = 0;
  let setIndex = 0;

  for (let i = 0; i < session.throwsPrescription.length; i++) {
    const block = session.throwsPrescription[i];
    const logged = throwsByBlock[i]?.length ?? 0;
    const target = block.sets * block.repsPerSet;

    if (logged < target) {
      blockIndex = i;
      setIndex = Math.floor(logged / block.repsPerSet);
      break;
    }

    // This block is complete, check next
    if (i === session.throwsPrescription.length - 1) {
      blockIndex = i; // Stay on last block (all done)
      setIndex = block.sets;
    }
  }

  return { blockIndex, setIndex, throwsByBlock, bestMarks };
}

// ── Computed Selectors ────────────────────────────────────────────────

export function useSessionComputed(state: SessionState) {
  return useMemo(() => {
    const { session, throwsByBlock, currentBlockIndex } = state;

    // Total throws logged across all blocks
    const totalThrowsLogged = Object.values(throwsByBlock).reduce(
      (sum, throws) => sum + throws.length,
      0,
    );

    // Current block from prescription
    const currentBlock = session?.throwsPrescription[currentBlockIndex] ?? null;

    // Throws logged in current block
    const currentBlockThrows = throwsByBlock[currentBlockIndex] ?? [];
    const currentBlockTarget = currentBlock
      ? currentBlock.sets * currentBlock.repsPerSet
      : 0;

    // Current set throws
    const currentSetThrows = currentBlock
      ? currentBlockThrows.filter(
          (_, i) =>
            i >= state.currentSetIndex * currentBlock.repsPerSet &&
            i < (state.currentSetIndex + 1) * currentBlock.repsPerSet,
        )
      : [];

    // Is current set complete?
    const currentSetComplete = currentBlock
      ? currentSetThrows.length >= currentBlock.repsPerSet
      : false;

    // Is current block complete?
    const currentBlockComplete = currentBlockThrows.length >= currentBlockTarget;

    // Total blocks
    const totalThrowBlocks = session?.throwsPrescription.length ?? 0;

    // Overall progress percentage
    const totalTarget = session?.totalThrowsTarget ?? 0;
    const overallProgress = totalTarget > 0
      ? Math.min(100, Math.round((totalThrowsLogged / totalTarget) * 100))
      : 0;

    // Best mark for current block
    const currentBlockBest = currentBlockThrows.length > 0
      ? Math.max(...currentBlockThrows.map((t) => t.distance))
      : null;

    // Overall best mark
    const overallBest = Object.values(state.bestMarks).length > 0
      ? Math.max(...Object.values(state.bestMarks))
      : null;

    return {
      totalThrowsLogged,
      currentBlock,
      currentBlockThrows,
      currentBlockTarget,
      currentSetThrows,
      currentSetComplete,
      currentBlockComplete,
      totalThrowBlocks,
      overallProgress,
      currentBlockBest,
      overallBest,
    };
  }, [state]);
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useSessionReducer() {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const computed = useSessionComputed(state);
  return { state, dispatch, computed };
}
