"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Target,
  Dumbbell,
  Flame,
  Snowflake,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Trophy,
  Clock,
} from "lucide-react";
import { Button, ProgressBar, AnimatedNumber } from "@/components";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";

/* ─── Types ──────────────────────────────────────────────────────────── */

type BlockData = {
  id: string;
  blockType: string;
  position: number;
  config: string;
};

type ExistingThrowLog = {
  id: string;
  blockId: string;
  throwNumber: number;
  distance: number | null;
  implement: string;
};

type WorkoutData = {
  assignmentId: string;
  status: string;
  sessionName: string;
  event: string;
  sessionType: string;
  blocks: BlockData[];
  existingThrowLogs: ExistingThrowLog[];
  startedAt: string | null;
};

type LoggedThrow = {
  id?: string;
  throwNumber: number;
  distance: number;
  isPersonalBest?: boolean;
};

type LoggedSet = {
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
};

type BlockState = {
  throws: LoggedThrow[];
  sets: LoggedSet[];
  warmupChecked: Set<number>;
  completed: boolean;
};

/* ─── Block config parsers ───────────────────────────────────────────── */

function parseConfig(config: string): Record<string, unknown> {
  try {
    return JSON.parse(config);
  } catch {
    return {};
  }
}

function getThrowCount(cfg: Record<string, unknown>): number {
  return (cfg.throwCount as number) || 10;
}

function getImplement(cfg: Record<string, unknown>): string {
  return (cfg.implementWeight as string) || (cfg.implement as string) || "";
}

function getImplementKg(cfg: Record<string, unknown>): number {
  const w = cfg.implementWeightKg as number;
  if (w && w > 0) return w;
  const str = getImplement(cfg);
  return parseFloat(str.replace("kg", "")) || 0;
}

/* ─── Block icons ────────────────────────────────────────────────────── */

const BLOCK_META: Record<string, { icon: typeof Target; color: string; label: string }> = {
  THROWING: { icon: Target, color: "text-orange-500", label: "Throwing" },
  STRENGTH: { icon: Dumbbell, color: "text-blue-500", label: "Strength" },
  WARMUP: { icon: Flame, color: "text-amber-500", label: "Warm-Up" },
  COOLDOWN: { icon: Snowflake, color: "text-cyan-500", label: "Cool-Down" },
};

/* ─── Elapsed Timer Hook ─────────────────────────────────────────────── */

function useElapsedTime(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(() => {
    if (!startedAt) return 0;
    return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (startedAt) {
        setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      } else {
        setElapsed((e) => e + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return elapsed;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ─── Self-Feeling Options ───────────────────────────────────────────── */

const FEELING_OPTIONS = [
  { value: "GREAT", label: "Great", emoji: "💪" },
  { value: "GOOD", label: "Good", emoji: "👍" },
  { value: "AVERAGE", label: "Average", emoji: "😐" },
  { value: "POOR", label: "Poor", emoji: "😓" },
  { value: "VERY_POOR", label: "Very Poor", emoji: "🤕" },
] as const;

/* ═══════════════════════════════════════════════════════════════════════ */
/*  THROWING BLOCK VIEW                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

function ThrowingBlockView({
  block,
  state,
  assignmentId,
  event,
  onThrowLogged,
}: {
  block: BlockData;
  state: BlockState;
  assignmentId: string;
  event: string;
  onThrowLogged: (t: LoggedThrow) => void;
}) {
  const { toast, celebration } = useToast();
  const [distance, setDistance] = useState("");
  const [logging, setLogging] = useState(false);

  const cfg = parseConfig(block.config);
  const target = getThrowCount(cfg);
  const implement = getImplement(cfg);
  const implementKg = getImplementKg(cfg);
  const technique = (cfg.techniqueFocus as string) || "FULL_THROW";
  const current = state.throws.length;
  const bestMark = useMemo(
    () => state.throws.reduce((max, t) => Math.max(max, t.distance), 0),
    [state.throws],
  );

  async function logThrow() {
    const d = parseFloat(distance);
    if (!d || d <= 0) {
      toast("Enter a valid distance", "error");
      return;
    }

    setLogging(true);
    try {
      const res = await fetch(`/api/throws/assignments/${assignmentId}/log-throw`, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          blockId: block.id,
          distance: d,
          implement: implement || `${implementKg}kg`,
          throwNumber: current + 1,
          event,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.error || "Failed to log throw", "error");
        return;
      }

      const logged: LoggedThrow = {
        id: data.data.throwLog.id,
        throwNumber: current + 1,
        distance: d,
        isPersonalBest: data.data.isPersonalBest,
      };
      onThrowLogged(logged);
      setDistance("");

      if (data.data.isPersonalBest) {
        celebration(`New PR! ${d.toFixed(2)}m`, {
          description: implement || event,
          highlight: `${d.toFixed(2)}m`,
        });
      }
    } catch {
      toast("Network error — try again", "error");
    } finally {
      setLogging(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Implement + technique header */}
      <div className="text-center space-y-2">
        {(implement || implementKg > 0) && (
          <div className="inline-flex items-center px-4 py-2 rounded-xl bg-orange-100 dark:bg-orange-900/25">
            <span className="text-2xl font-heading font-bold text-orange-600 dark:text-orange-400">
              {implement || `${implementKg}kg`}
            </span>
          </div>
        )}
        {technique !== "FULL_THROW" && (
          <p className="text-sm text-muted capitalize">
            {technique.replace(/_/g, " ").toLowerCase()}
          </p>
        )}
      </div>

      {/* Throw counter */}
      <div className="text-center">
        <p className="text-sm text-muted uppercase tracking-wider mb-1">Throw</p>
        <div className="flex items-baseline justify-center gap-1">
          <NumberFlow value={current} className="text-3xl font-heading font-bold text-[var(--foreground)]" />
          <span className="text-lg text-muted">/ {target}</span>
        </div>
      </div>

      {/* Distance input + log button */}
      {current < target && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted uppercase tracking-wider mb-1 block">
              Distance (m)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && logThrow()}
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] text-lg tabular-nums font-medium text-center focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              autoFocus
              inputMode="decimal"
            />
          </div>
          <Button
            variant="primary"
            onClick={logThrow}
            disabled={logging || !distance}
            className="px-6 py-2.5"
          >
            {logging ? "..." : "Log"}
          </Button>
        </div>
      )}

      {/* Best mark */}
      {bestMark > 0 && (
        <div className="text-center p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <p className="text-xs text-muted uppercase tracking-wider">Best Mark</p>
          <AnimatedNumber value={bestMark} decimals={2} className="text-xl font-heading font-bold text-primary-600 dark:text-primary-400" />
          <span className="text-sm text-primary-500 ml-1">m</span>
        </div>
      )}

      {/* Logged throws list */}
      {state.throws.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted uppercase tracking-wider">Logged Throws</p>
          <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
            {[...state.throws].reverse().map((t) => (
              <div
                key={t.throwNumber}
                className={`flex items-center justify-between px-3 py-1.5 rounded-md text-sm ${
                  t.isPersonalBest
                    ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800"
                    : "bg-surface-50 dark:bg-surface-800/50"
                }`}
              >
                <span className="text-muted tabular-nums">#{t.throwNumber}</span>
                <span className={`font-medium tabular-nums ${t.isPersonalBest ? "text-amber-600 dark:text-amber-400" : "text-[var(--foreground)]"}`}>
                  {t.distance.toFixed(2)}m
                  {t.isPersonalBest && (
                    <Trophy size={12} strokeWidth={1.75} className="inline ml-1 text-amber-500" aria-hidden="true" />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Block complete message */}
      {current >= target && (
        <div className="text-center p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-800">
          <Check size={24} strokeWidth={1.75} className="mx-auto text-emerald-500 mb-1" aria-hidden="true" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Block Complete!
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  STRENGTH BLOCK VIEW                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

function StrengthBlockView({
  block,
  state,
  onSetLogged,
}: {
  block: BlockData;
  state: BlockState;
  onSetLogged: (s: LoggedSet) => void;
}) {
  const { toast } = useToast();
  const cfg = parseConfig(block.config);
  const exercises = (cfg.exercises as Array<Record<string, unknown>>) ?? [];

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);

  function logSet() {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!r || r <= 0) {
      toast("Enter reps completed", "error");
      return;
    }
    onSetLogged({
      setNumber: state.sets.length + 1,
      reps: r,
      weight: w || 0,
      rpe,
    });
    setWeight("");
    setReps("");
    setRpe(null);
  }

  return (
    <div className="space-y-5">
      {/* Exercise list */}
      {exercises.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted uppercase tracking-wider">Prescribed</p>
          {exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-surface-50 dark:bg-surface-800/50">
              <span className="font-medium text-[var(--foreground)]">{(ex.name as string) || "Exercise"}</span>
              <span className="text-muted tabular-nums">
                {ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : "—"}
                {ex.percentage ? ` @ ${ex.percentage}%` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Log set form */}
      <div className="space-y-3">
        <p className="text-xs text-muted uppercase tracking-wider">
          Log Set {state.sets.length + 1}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted mb-1 block">Weight (kg)</label>
            <input
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Reps</label>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && logSet()}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              inputMode="numeric"
            />
          </div>
        </div>
        {/* RPE selector */}
        <div>
          <label className="text-xs text-muted mb-1 block">RPE (optional)</label>
          <div className="flex gap-1">
            {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
              <button
                key={v}
                onClick={() => setRpe(rpe === v ? null : v)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  rpe === v
                    ? "bg-primary-500 text-white"
                    : "bg-surface-100 dark:bg-surface-800 text-muted hover:bg-surface-200 dark:hover:bg-surface-700"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={logSet} className="w-full">
          Log Set
        </Button>
      </div>

      {/* Logged sets */}
      {state.sets.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted uppercase tracking-wider">Completed Sets</p>
          {state.sets.map((s) => (
            <div key={s.setNumber} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-md bg-surface-50 dark:bg-surface-800/50">
              <span className="text-muted">Set {s.setNumber}</span>
              <span className="font-medium tabular-nums text-[var(--foreground)]">
                {s.weight > 0 ? `${s.weight}kg × ` : ""}{s.reps} reps
                {s.rpe != null && <span className="text-muted ml-1">RPE {s.rpe}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  WARMUP/COOLDOWN BLOCK VIEW                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

function WarmupCooldownView({
  block,
  state,
  onToggleDrill,
}: {
  block: BlockData;
  state: BlockState;
  onToggleDrill: (idx: number) => void;
}) {
  const cfg = parseConfig(block.config);
  const drills = (cfg.drills as string[]) ?? [];
  const duration = cfg.duration as number | undefined;

  return (
    <div className="space-y-4">
      {duration && (
        <p className="text-sm text-muted text-center">{duration} minutes</p>
      )}
      {drills.length > 0 ? (
        <div className="space-y-2">
          {drills.map((drill, i) => (
            <button
              key={i}
              onClick={() => onToggleDrill(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                state.warmupChecked.has(i)
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800"
                  : "bg-[var(--card-bg)] border-[var(--card-border)] hover:bg-surface-50 dark:hover:bg-surface-800/50"
              }`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                state.warmupChecked.has(i)
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-surface-300 dark:border-surface-600"
              }`}>
                {state.warmupChecked.has(i) && (
                  <Check size={12} strokeWidth={2.5} className="text-white" aria-hidden="true" />
                )}
              </div>
              <span className={`text-sm ${
                state.warmupChecked.has(i) ? "text-muted line-through" : "text-[var(--foreground)]"
              }`}>
                {drill}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted text-center py-4">
          Complete your {block.blockType.toLowerCase()} routine
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  COMPLETION SCREEN                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

function CompletionScreen({
  assignmentId,
  blockStates,
  elapsed,
}: {
  assignmentId: string;
  blockStates: Map<string, BlockState>;
  elapsed: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rpe, setRpe] = useState(7);
  const [feeling, setFeeling] = useState<string>("GOOD");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Aggregate stats
  const allThrows: LoggedThrow[] = [];
  const allSets: LoggedSet[] = [];
  for (const [, state] of blockStates) {
    allThrows.push(...state.throws);
    allSets.push(...state.sets);
  }
  const totalThrows = allThrows.length;
  const bestMark = allThrows.reduce((max, t) => Math.max(max, t.distance), 0);
  const totalVolume = allSets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  const prCount = allThrows.filter((t) => t.isPersonalBest).length;

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/throws/assignments/${assignmentId}`, {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({
          action: "complete",
          rpe,
          selfFeeling: feeling,
          feedbackNotes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast(data.error || "Failed to submit", "error");
        setSubmitting(false);
        return;
      }
      toast("Session complete!", "celebration");
      router.push("/athlete/dashboard");
    } catch {
      toast("Network error", "error");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2 py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
          <Trophy size={28} strokeWidth={1.75} className="text-emerald-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-heading font-bold text-[var(--foreground)]">Session Complete!</h2>
        <p className="text-sm text-muted">{formatElapsed(elapsed)} total</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xs text-muted uppercase tracking-wider">Throws</p>
          <AnimatedNumber value={totalThrows} className="text-xl font-heading font-bold text-[var(--foreground)]" />
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-muted uppercase tracking-wider">Best Mark</p>
          <p className="text-xl font-heading font-bold text-[var(--foreground)] tabular-nums">
            {bestMark > 0 ? `${bestMark.toFixed(2)}m` : "—"}
          </p>
        </div>
        {totalVolume > 0 && (
          <div className="card p-3 text-center">
            <p className="text-xs text-muted uppercase tracking-wider">Volume</p>
            <p className="text-xl font-heading font-bold text-[var(--foreground)] tabular-nums">
              {totalVolume.toLocaleString()}kg
            </p>
          </div>
        )}
        {prCount > 0 && (
          <div className="card p-3 text-center bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800">
            <p className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">PRs Hit</p>
            <AnimatedNumber value={prCount} className="text-xl font-heading font-bold text-amber-600 dark:text-amber-400" />
          </div>
        )}
      </div>

      {/* RPE slider */}
      <div className="space-y-2">
        <label className="text-xs text-muted uppercase tracking-wider block">
          Session RPE
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={rpe}
            onChange={(e) => setRpe(parseInt(e.target.value))}
            className="flex-1 accent-primary-500"
          />
          <NumberFlow value={rpe} className="text-xl font-bold text-[var(--foreground)] w-8 text-center" />
        </div>
      </div>

      {/* Self-feeling */}
      <div className="space-y-2">
        <label className="text-xs text-muted uppercase tracking-wider block">
          How did you feel?
        </label>
        <div className="flex gap-1.5">
          {FEELING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFeeling(opt.value)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                feeling === opt.value
                  ? "bg-primary-500 text-white"
                  : "bg-surface-100 dark:bg-surface-800 text-muted hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              <span className="block text-base">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-xs text-muted uppercase tracking-wider block">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any observations, aches, or breakthroughs..."
          className="w-full px-3 py-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </div>

      {/* Submit — SlideToConfirm on mobile, button on desktop */}
      <div className="sm:hidden">
        <SlideToConfirm
          label="Slide to Submit Session"
          onConfirm={submit}
          disabled={submitting}
          variant="confirm"
        />
      </div>
      <div className="hidden sm:block">
        <Button
          variant="primary"
          className="w-full"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit Session"}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  MAIN LIVE WORKOUT COMPONENT                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

export function LiveWorkout({ data }: { data: WorkoutData }) {
  const router = useRouter();
  const { toast } = useToast();
  const elapsed = useElapsedTime(data.startedAt ?? new Date().toISOString());

  // Block navigation
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const totalBlocks = data.blocks.length;
  const activeBlock = data.blocks[activeBlockIdx];

  // Block states
  const [blockStates, setBlockStates] = useState<Map<string, BlockState>>(() => {
    const map = new Map<string, BlockState>();
    for (const block of data.blocks) {
      const existingThrows = data.existingThrowLogs
        .filter((tl) => tl.blockId === block.id)
        .map((tl) => ({
          throwNumber: tl.throwNumber,
          distance: tl.distance ?? 0,
          id: tl.id,
        }));

      map.set(block.id, {
        throws: existingThrows,
        sets: [],
        warmupChecked: new Set<number>(),
        completed: false,
      });
    }
    return map;
  });

  // Unsaved changes warning
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Progress calculation
  const completedBlocks = useMemo(() => {
    let count = 0;
    for (const block of data.blocks) {
      const state = blockStates.get(block.id);
      if (!state) continue;
      const bt = block.blockType.toUpperCase();
      if (bt === "THROWING") {
        const cfg = parseConfig(block.config);
        const target = getThrowCount(cfg);
        if (state.throws.length >= target) count++;
      } else if (bt === "STRENGTH") {
        if (state.sets.length > 0) count++;
      } else {
        // Warmup/Cooldown — always count as done if visited past it
        if (activeBlockIdx > data.blocks.indexOf(block) || state.warmupChecked.size > 0) count++;
      }
    }
    return count;
  }, [blockStates, activeBlockIdx, data.blocks]);

  const progressPercent = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

  // Handlers
  const handleThrowLogged = useCallback(
    (blockId: string, t: LoggedThrow) => {
      setBlockStates((prev) => {
        const next = new Map(prev);
        const state = { ...next.get(blockId)! };
        state.throws = [...state.throws, t];
        next.set(blockId, state);
        return next;
      });
    },
    [],
  );

  const handleSetLogged = useCallback(
    (blockId: string, s: LoggedSet) => {
      setBlockStates((prev) => {
        const next = new Map(prev);
        const state = { ...next.get(blockId)! };
        state.sets = [...state.sets, s];
        next.set(blockId, state);
        return next;
      });
    },
    [],
  );

  const handleToggleDrill = useCallback(
    (blockId: string, idx: number) => {
      setBlockStates((prev) => {
        const next = new Map(prev);
        const state = { ...next.get(blockId)! };
        const checked = new Set(state.warmupChecked);
        if (checked.has(idx)) checked.delete(idx);
        else checked.add(idx);
        state.warmupChecked = checked;
        next.set(blockId, state);
        return next;
      });
    },
    [],
  );

  function goNext() {
    if (activeBlockIdx < totalBlocks - 1) {
      setActiveBlockIdx(activeBlockIdx + 1);
    } else {
      setShowCompletion(true);
    }
  }

  function goPrev() {
    if (showCompletion) {
      setShowCompletion(false);
    } else if (activeBlockIdx > 0) {
      setActiveBlockIdx(activeBlockIdx - 1);
    }
  }

  async function endEarly() {
    if (!confirm("End this session early? Your logged data will be saved.")) return;
    try {
      await fetch(`/api/throws/assignments/${data.assignmentId}`, {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "partial" }),
      });
      toast("Session ended", "info");
      router.push("/athlete/dashboard");
    } catch {
      toast("Network error", "error");
    }
  }

  // Completion screen
  if (showCompletion) {
    return (
      <div className="max-w-lg mx-auto py-4 px-1">
        <button onClick={goPrev} className="inline-flex items-center gap-1 text-sm text-muted hover:text-[var(--foreground)] mb-4">
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Back to blocks
        </button>
        <CompletionScreen
          assignmentId={data.assignmentId}
          blockStates={blockStates}
          elapsed={elapsed}
        />
      </div>
    );
  }

  const blockMeta = BLOCK_META[activeBlock?.blockType?.toUpperCase()] ?? BLOCK_META.THROWING;
  const BlockIcon = blockMeta.icon;
  const currentState = blockStates.get(activeBlock?.id) ?? {
    throws: [], sets: [], warmupChecked: new Set<number>(), completed: false,
  };

  return (
    <div className="max-w-lg mx-auto py-2 px-1 space-y-4">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-heading font-bold text-[var(--foreground)] truncate flex-1">
            {data.sessionName}
          </h1>
          <Button variant="ghost" size="sm" onClick={endEarly} className="text-xs shrink-0">
            <X size={14} strokeWidth={1.75} className="mr-1" aria-hidden="true" />
            End Early
          </Button>
        </div>

        {/* Progress bar */}
        <ProgressBar value={progressPercent} animate={false} />

        {/* Timer + block count */}
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} strokeWidth={1.75} aria-hidden="true" />
            <NumberFlow value={Math.floor(elapsed / 60)} suffix={`:${String(elapsed % 60).padStart(2, "0")}`} duration={0} className="tabular-nums" />
          </span>
          <span className="tabular-nums">
            Block {activeBlockIdx + 1} of {totalBlocks}
          </span>
        </div>
      </div>

      {/* Block stepper dots */}
      <div className="flex items-center justify-center gap-1.5">
        {data.blocks.map((block, i) => {
          const state = blockStates.get(block.id);
          const bt = block.blockType.toUpperCase();
          const isThrowDone = bt === "THROWING" && (state?.throws.length ?? 0) >= getThrowCount(parseConfig(block.config));
          const isStrengthDone = bt === "STRENGTH" && (state?.sets.length ?? 0) > 0;
          const isDone = isThrowDone || isStrengthDone || (i < activeBlockIdx && (bt === "WARMUP" || bt === "COOLDOWN"));
          const isActive = i === activeBlockIdx;

          return (
            <button
              key={block.id}
              onClick={() => setActiveBlockIdx(i)}
              className={`w-3 h-3 rounded-full transition-all ${
                isDone
                  ? "bg-emerald-500"
                  : isActive
                    ? "bg-primary-500 scale-125"
                    : "bg-surface-300 dark:bg-surface-600"
              }`}
              title={`Block ${i + 1}: ${block.blockType}`}
            />
          );
        })}
      </div>

      {/* Active block card */}
      <div className="card p-5 space-y-4">
        {/* Block type label */}
        <div className="flex items-center gap-2">
          <BlockIcon size={18} strokeWidth={1.75} className={blockMeta.color} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            {blockMeta.label}
          </h2>
          <span className="text-xs text-muted ml-auto tabular-nums">
            Block {activeBlockIdx + 1}
          </span>
        </div>

        {/* Block content */}
        {activeBlock?.blockType?.toUpperCase() === "THROWING" && (
          <ThrowingBlockView
            block={activeBlock}
            state={currentState}
            assignmentId={data.assignmentId}
            event={data.event}
            onThrowLogged={(t) => handleThrowLogged(activeBlock.id, t)}
          />
        )}
        {activeBlock?.blockType?.toUpperCase() === "STRENGTH" && (
          <StrengthBlockView
            block={activeBlock}
            state={currentState}
            onSetLogged={(s) => handleSetLogged(activeBlock.id, s)}
          />
        )}
        {(activeBlock?.blockType?.toUpperCase() === "WARMUP" ||
          activeBlock?.blockType?.toUpperCase() === "COOLDOWN") && (
          <WarmupCooldownView
            block={activeBlock}
            state={currentState}
            onToggleDrill={(idx) => handleToggleDrill(activeBlock.id, idx)}
          />
        )}
      </div>

      {/* Block navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={goPrev}
          disabled={activeBlockIdx === 0}
          className="flex-1"
          leftIcon={<ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          Previous
        </Button>
        <Button
          variant="primary"
          onClick={goNext}
          className="flex-1"
          rightIcon={<ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          {activeBlockIdx === totalBlocks - 1 ? "Finish" : "Next Block"}
        </Button>
      </div>
    </div>
  );
}
