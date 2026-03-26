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
import { Button, ProgressBar, AnimatedNumber, RestTimer } from "@/components";
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
  distance: number | null;  // null for skipped throws
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

function getRestSeconds(cfg: Record<string, unknown>): number {
  return (cfg.restSeconds as number) || 0;
}

/* ─── Block icons ────────────────────────────────────────────────────── */

const BLOCK_META: Record<string, { icon: typeof Target; color: string; label: string }> = {
  THROWING: { icon: Target, color: "text-orange-500", label: "Throwing" },
  STRENGTH: { icon: Dumbbell, color: "text-blue-500", label: "Strength" },
  WARMUP: { icon: Flame, color: "text-amber-500", label: "Warm-Up" },
  COOLDOWN: { icon: Snowflake, color: "text-cyan-500", label: "Cool-Down" },
};

/* ─── Classification color system ───────────────────────────────────── */

const CLASSIFICATION_ACCENT: Record<string, string> = {
  CE: "#FFC800", SDE: "#FF8800", SPE: "#00FF88", GPE: "#4488FF",
  STRENGTH: "#4488FF", WARMUP: "#FF8800", COOLDOWN: "#00BBFF",
};

function getBlockAccent(block: BlockData): string {
  const cfg = parseConfig(block.config);
  const classification = cfg.classification as string;
  if (classification && CLASSIFICATION_ACCENT[classification]) {
    return CLASSIFICATION_ACCENT[classification];
  }
  return CLASSIFICATION_ACCENT[block.blockType] ?? "#FFC800";
}

function getBlockLabel(block: BlockData): string {
  const cfg = parseConfig(block.config);
  const name = (cfg.exerciseName as string) || (cfg.drillName as string) || "";
  const impl = getImplement(cfg);
  const classification = (cfg.classification as string) || "";
  return [classification, impl ? impl : "", name].filter(Boolean).join(" · ");
}

function getExerciseName(block: BlockData): string {
  const cfg = parseConfig(block.config);
  return (cfg.exerciseName as string) || (cfg.drillName as string) || block.blockType;
}

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
  const [showRest, setShowRest] = useState(false);
  const [inputExpanded, setInputExpanded] = useState(false);

  const accent = getBlockAccent(block);
  const cfg = parseConfig(block.config);
  const target = getThrowCount(cfg);
  const implement = getImplement(cfg);
  const implementKg = getImplementKg(cfg);
  const restSeconds = getRestSeconds(cfg);
  const technique = (cfg.techniqueFocus as string) || "FULL_THROW";
  const current = state.throws.length;
  const bestMark = useMemo(
    () =>
      state.throws
        .filter((t) => t.distance !== null)
        .reduce((max, t) => Math.max(max, t.distance as number), 0),
    [state.throws],
  );

  const chamfer =
    "polygon(0 0,calc(100% - 3px) 0,100% 3px,100% 100%,3px 100%,0 calc(100% - 3px))";
  const chamferLg =
    "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))";

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
      setInputExpanded(false);

      // Show rest timer if restSeconds configured and throws remain
      if (restSeconds > 0 && current + 1 < target) {
        setShowRest(true);
      }

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

  function skipThrow() {
    onThrowLogged({ throwNumber: current + 1, distance: null });
  }

  return (
    <div className="space-y-5">
      {/* ── Hero Throw Counter ── */}
      <div className="text-center pt-2">
        <p
          className="text-[8px] uppercase font-semibold mb-1"
          style={{ letterSpacing: "4px", color: `${accent}44` }}
        >
          THROW
        </p>
        <div
          className="flex items-baseline justify-center"
          style={{ textShadow: `0 0 50px ${accent}33` }}
        >
          <NumberFlow
            value={current + (current < target ? 1 : 0)}
            className="font-heading font-extrabold"
            style={{ fontSize: "72px", lineHeight: 1, color: accent }}
          />
          <span
            className="font-heading font-semibold ml-1"
            style={{ fontSize: "22px", color: `${accent}66` }}
          >
            /{target}
          </span>
        </div>
        {technique !== "FULL_THROW" && (
          <p className="text-xs mt-1 capitalize" style={{ color: `${accent}88` }}>
            {technique.replace(/_/g, " ").toLowerCase()}
          </p>
        )}
      </div>

      {/* ── Progress Grid ── */}
      <div className="flex flex-wrap justify-center gap-[3px]">
        {Array.from({ length: target }, (_, i) => {
          const num = i + 1;
          const logged = state.throws.find((t) => t.throwNumber === num);
          const isCurrent = num === current + 1 && current < target;
          const isDone = logged && logged.distance !== null;
          const isSkipped = logged && logged.distance === null;

          let bg = "#111";
          let fg = "#333";
          let label = String(num);

          if (isDone) {
            bg = "#00FF88";
            fg = "#000";
            label = "\u2713";
          } else if (isSkipped) {
            bg = "#111";
            fg = "#555";
            label = "\u2014";
          } else if (isCurrent) {
            bg = accent;
            fg = "#000";
          }

          return (
            <div
              key={num}
              className="w-5 h-5 flex items-center justify-center font-semibold select-none"
              style={{
                fontSize: "7px",
                backgroundColor: bg,
                color: fg,
                clipPath: chamfer,
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* ── Best Mark Badge ── */}
      {bestMark > 0 && (
        <div className="flex justify-end">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm"
            style={{ backgroundColor: `${accent}11`, border: `1px solid ${accent}22` }}
          >
            <span className="text-[9px] uppercase font-semibold" style={{ color: `${accent}88`, letterSpacing: "2px" }}>
              Best
            </span>
            <span style={{ color: accent }}>
              <AnimatedNumber
                value={bestMark}
                decimals={2}
                className="text-sm font-heading font-bold"
              />
            </span>
            <span className="text-xs" style={{ color: `${accent}66` }}>m</span>
          </div>
        </div>
      )}

      {/* ── Rest Timer ── */}
      {showRest && restSeconds > 0 && (
        <div className="flex flex-col items-center py-2">
          <RestTimer
            seconds={restSeconds}
            autoStart
            compact={false}
            onComplete={() => setShowRest(false)}
          />
          <button
            onClick={() => setShowRest(false)}
            className="mt-2 text-xs text-muted hover:text-[var(--foreground)] transition-colors min-h-[44px]"
          >
            Skip Rest
          </button>
        </div>
      )}

      {/* ── Distance Input Card ── */}
      {current < target && !showRest && (
        <>
          {!inputExpanded ? (
            <button
              onClick={() => setInputExpanded(true)}
              className="w-full min-h-[56px] flex items-center justify-center transition-colors"
              style={{
                backgroundColor: "#08080a",
                border: `1px solid ${accent}40`,
                clipPath: chamferLg,
              }}
            >
              <span
                className="text-[10px] uppercase font-bold"
                style={{ letterSpacing: "3px", color: `${accent}cc` }}
              >
                TAP TO LOG THROW #{current + 1}
              </span>
            </button>
          ) : (
            <div
              className="p-4 space-y-3"
              style={{
                backgroundColor: "#08080a",
                border: `1px solid ${accent}40`,
                clipPath: chamferLg,
              }}
            >
              <label
                className="text-[9px] uppercase font-semibold block"
                style={{ letterSpacing: "2px", color: `${accent}88` }}
              >
                Distance (m) — Throw #{current + 1}
              </label>
              <div className="flex gap-2 items-end">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") logThrow();
                    if (e.key === "Escape") setInputExpanded(false);
                  }}
                  placeholder="0.00"
                  className="flex-1 px-3 py-3 rounded-md border text-lg tabular-nums font-medium text-center focus:outline-none"
                  style={{
                    backgroundColor: "#0a0a0c",
                    borderColor: `${accent}33`,
                    color: accent,
                  }}
                  autoFocus
                  inputMode="decimal"
                />
                <button
                  onClick={logThrow}
                  disabled={logging || !distance}
                  className="px-5 min-h-[48px] font-bold text-xs uppercase disabled:opacity-40 transition-opacity"
                  style={{
                    letterSpacing: "2px",
                    backgroundColor: accent,
                    color: "#000",
                    clipPath: chamferLg,
                  }}
                >
                  {logging ? "..." : "LOG"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Skip Button ── */}
      {current < target && !showRest && (
        <button
          onClick={skipThrow}
          className="w-full min-h-[44px] py-3 text-[10px] uppercase font-bold transition-colors"
          style={{
            letterSpacing: "3px",
            color: `${accent}88`,
            backgroundColor: "transparent",
            border: `1px solid ${accent}55`,
            clipPath: chamferLg,
          }}
        >
          SKIP (NO MARK)
        </button>
      )}

      {/* ── Logged Throws Mini-List ── */}
      {state.throws.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
          {state.throws.map((t) => (
            <span
              key={t.throwNumber}
              className="text-xs tabular-nums"
              style={{ color: t.isPersonalBest ? "#FFC800" : `${accent}88` }}
            >
              #{t.throwNumber}{" "}
              {t.distance !== null ? `${t.distance.toFixed(2)}m` : "\u2014"}
              {t.isPersonalBest && (
                <Trophy size={10} strokeWidth={1.75} className="inline ml-0.5" aria-hidden="true" />
              )}
            </span>
          ))}
        </div>
      )}

      {/* ── Block Complete ── */}
      {current >= target && (
        <div
          className="text-center py-4"
          style={{
            backgroundColor: "#00FF8811",
            border: "1px solid #00FF8833",
            clipPath: chamferLg,
          }}
        >
          <Check size={20} strokeWidth={1.75} className="mx-auto mb-1" style={{ color: "#00FF88" }} aria-hidden="true" />
          <p className="text-xs font-bold uppercase" style={{ letterSpacing: "3px", color: "#00FF88" }}>
            Block Complete
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
  const restSeconds = getRestSeconds(cfg);

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [showRest, setShowRest] = useState(false);

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

    // Show rest timer after logging a set
    if (restSeconds > 0) {
      setShowRest(true);
    }
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

      {/* Rest timer (shown after logging a set) */}
      {showRest && restSeconds > 0 && (
        <div className="flex flex-col items-center py-2">
          <RestTimer
            seconds={restSeconds}
            autoStart
            compact={false}
            onComplete={() => setShowRest(false)}
          />
          <button
            onClick={() => setShowRest(false)}
            className="mt-2 text-xs text-muted hover:text-[var(--foreground)] transition-colors"
          >
            Skip Rest
          </button>
        </div>
      )}

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
  const bestMark = allThrows.reduce((max, t) => Math.max(max, t.distance!), 0); // TODO: Task 4 will add proper null guard
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

  // Unsaved changes warning + back button protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Push a dummy history entry so the back button hits our handler first
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      if (confirm("Leave workout? Your logged throws are saved, but the session won't be marked complete.")) {
        window.history.back();
      } else {
        window.history.pushState(null, "", window.location.href);
      }
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
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
            <span className="tabular-nums">
              <NumberFlow value={Math.floor(elapsed / 60)} duration={0} />
              <span>:</span>
              <NumberFlow value={elapsed % 60} prefix={elapsed % 60 < 10 ? "0" : ""} duration={0} />
            </span>
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
