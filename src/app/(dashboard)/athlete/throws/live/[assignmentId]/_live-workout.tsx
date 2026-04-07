"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Check,
  Trophy,
  Video,
} from "lucide-react";
import { AnimatedNumber, RestTimer } from "@/components";
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
  notes: string | null;
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
  return (cfg.implement as string) || "";
}

function getImplementKg(cfg: Record<string, unknown>): number {
  // start-live stores implementWeightKg as a numeric field
  const w = cfg.implementWeightKg as number;
  if (w && w > 0) return w;
  // Fallback: parse from implement string (e.g. "7.26kg")
  const str = getImplement(cfg);
  const parsed = parseFloat(str.replace(/[^0-9.]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

function getRestSeconds(cfg: Record<string, unknown>): number {
  return (cfg.restSeconds as number) || 0;
}

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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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
        signal: AbortSignal.timeout(8000),
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

      // Upload video to codex in the background if captured
      if (videoFile) {
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("event", event);
        formData.append("implement", implement || `${implementKg}kg`);
        formData.append("distance", String(d));
        fetch("/api/codex", {
          method: "POST",
          headers: { ...csrfHeaders() },
          body: formData,
        }).then(() => {
          toast("Video saved to Codex", "success");
        }).catch(() => {
          toast("Video upload failed", "error");
        });
        setVideoFile(null);
      }

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
    } catch (err) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        toast("Connection slow — your throw will save when reception improves", "error");
      } else {
        toast("Network error — try again", "error");
      }
    } finally {
      setLogging(false);
    }
  }

  async function skipThrow() {
    try {
      await fetch(`/api/throws/assignments/${assignmentId}/log-throw`, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          blockId: block.id,
          distance: null,
          implement: implement || `${implementKg}kg`,
          throwNumber: current + 1,
          event,
        }),
      });
    } catch {
      // Best-effort — still advance locally even if persistence fails
    }
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
              {/* Hidden video input */}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 200 * 1024 * 1024) {
                      toast("Video too large (max 200MB)", "error");
                      return;
                    }
                    setVideoFile(file);
                  }
                  e.target.value = "";
                }}
              />

              {/* Distance + LOG row */}
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
                  className="px-6 min-h-[48px] font-bold text-xs uppercase disabled:opacity-40 transition-opacity"
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

              {/* Video capture row */}
              <button
                onClick={() => videoInputRef.current?.click()}
                type="button"
                className="w-full min-h-[44px] flex items-center justify-center gap-2 transition-opacity"
                style={{
                  backgroundColor: videoFile ? `${accent}11` : "transparent",
                  border: `1px solid ${videoFile ? accent : `${accent}22`}`,
                  clipPath: chamferLg,
                }}
              >
                <Video size={14} strokeWidth={1.75} style={{ color: videoFile ? accent : `${accent}66` }} aria-hidden="true" />
                <span
                  className="text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "2px", color: videoFile ? accent : `${accent}66` }}
                >
                  {videoFile ? "Video Attached ✓" : "Add Video"}
                </span>
              </button>
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
  assignmentId,
}: {
  block: BlockData;
  state: BlockState;
  onSetLogged: (s: LoggedSet) => void;
  assignmentId: string;
}) {
  const { toast } = useToast();
  const accent = getBlockAccent(block);
  const cfg = parseConfig(block.config);
  const exercises = (cfg.exercises as Array<Record<string, unknown>>) ?? [];
  const restSeconds = getRestSeconds(cfg);

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [showRest, setShowRest] = useState(false);
  const [logging, setLogging] = useState(false);

  const chamferLg =
    "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))";

  async function logSet() {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!r || r <= 0) {
      toast("Enter reps completed", "error");
      return;
    }

    setLogging(true);
    const setNumber = state.sets.length + 1;
    const exerciseName = exercises[0]?.exerciseName as string || "Strength";

    try {
      // Persist to DB via log-throw — repurpose fields for strength:
      // throwNumber → setNumber, distance → weight, implement → exerciseName, notes → {reps, rpe}
      await fetch(`/api/throws/assignments/${assignmentId}/log-throw`, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          blockId: block.id,
          distance: w || null,
          implement: exerciseName,
          throwNumber: setNumber,
          notes: JSON.stringify({ reps: r, rpe, type: "strength" }),
        }),
      });
    } catch {
      // Best-effort — still advance locally
    } finally {
      setLogging(false);
    }

    onSetLogged({
      setNumber,
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
      {/* ── Mini Hero: Set Counter ── */}
      <div className="text-center pt-1">
        <p
          className="text-[8px] uppercase font-semibold mb-1"
          style={{ letterSpacing: "4px", color: `${accent}44` }}
        >
          SET
        </p>
        <div
          className="flex items-baseline justify-center"
          style={{ textShadow: `0 0 40px ${accent}22` }}
        >
          <NumberFlow
            value={state.sets.length + 1}
            className="font-heading font-extrabold"
            style={{ fontSize: "32px", lineHeight: 1, color: accent }}
          />
          {exercises.length > 0 && (
            <span
              className="font-heading font-semibold ml-1"
              style={{ fontSize: "16px", color: `${accent}55` }}
            >
              {/* total sets prescribed from first exercise if available */}
              {exercises[0].sets ? `/ ${exercises[0].sets}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Exercise list (prescribed) ── */}
      {exercises.length > 0 && (
        <div
          className="p-3 space-y-2"
          style={{
            backgroundColor: "#08080a",
            border: "1px solid #ffffff08",
            clipPath: chamferLg,
          }}
        >
          <p
            className="text-[9px] uppercase font-semibold"
            style={{ letterSpacing: "3px", color: `${accent}66` }}
          >
            Prescribed
          </p>
          {exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between">
              <span
                className="text-lg font-heading font-bold"
                style={{ color: accent }}
              >
                {(ex.name as string) || "Exercise"}
              </span>
              <span
                className="text-sm tabular-nums font-medium"
                style={{ color: `${accent}99` }}
              >
                {ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : "—"}
                {ex.percentage ? ` @ ${ex.percentage}%` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Log Set Form ── */}
      <div
        className="p-4 space-y-4"
        style={{
          backgroundColor: "#08080a",
          border: `1px solid ${accent}22`,
          clipPath: chamferLg,
        }}
      >
        <p
          className="text-[9px] uppercase font-semibold"
          style={{ letterSpacing: "3px", color: `${accent}66` }}
        >
          Log Set {state.sets.length + 1}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="text-[9px] uppercase font-semibold mb-1.5 block"
              style={{ letterSpacing: "2px", color: `${accent}66` }}
            >
              Weight (kg)
            </label>
            <input
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-3 border tabular-nums text-center focus:outline-none transition-colors"
              style={{
                backgroundColor: "#0a0a0a",
                borderColor: "#1a1a1e",
                color: accent,
                fontSize: "18px",
                fontWeight: 600,
              }}
              inputMode="decimal"
            />
          </div>
          <div>
            <label
              className="text-[9px] uppercase font-semibold mb-1.5 block"
              style={{ letterSpacing: "2px", color: `${accent}66` }}
            >
              Reps
            </label>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && logSet()}
              placeholder="0"
              className="w-full px-3 py-3 border tabular-nums text-center focus:outline-none transition-colors"
              style={{
                backgroundColor: "#0a0a0a",
                borderColor: "#1a1a1e",
                color: accent,
                fontSize: "18px",
                fontWeight: 600,
              }}
              inputMode="numeric"
            />
          </div>
        </div>

        {/* RPE selector */}
        <div>
          <label
            className="text-[9px] uppercase font-semibold mb-2 block"
            style={{ letterSpacing: "2px", color: `${accent}66` }}
          >
            RPE{" "}
            {rpe !== null && (
              <span style={{ color: accent }}>— {rpe}</span>
            )}
          </label>
          <div className="flex gap-1">
            {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
              <button
                key={v}
                onClick={() => setRpe(rpe === v ? null : v)}
                className="flex-1 py-2 text-xs font-bold transition-all min-h-[44px]"
                style={{
                  backgroundColor: rpe === v ? accent : "#111117",
                  color: rpe === v ? "#000" : `${accent}55`,
                  border: `1px solid ${rpe === v ? accent : "#1a1a1e"}`,
                  clipPath:
                    "polygon(0 0,calc(100% - 3px) 0,100% 3px,100% 100%,3px 100%,0 calc(100% - 3px))",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Log Set button */}
        <button
          onClick={logSet}
          disabled={!reps || logging}
          className="w-full min-h-[52px] font-bold text-[11px] uppercase disabled:opacity-40 transition-opacity"
          style={{
            letterSpacing: "3px",
            backgroundColor: accent,
            color: "#000",
            clipPath: chamferLg,
          }}
        >
          LOG SET {state.sets.length + 1}
        </button>
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
            className="mt-2 text-xs transition-colors min-h-[44px]"
            style={{ color: `${accent}66` }}
          >
            Skip Rest
          </button>
        </div>
      )}

      {/* Logged sets */}
      {state.sets.length > 0 && (
        <div className="space-y-1.5">
          <p
            className="text-[9px] uppercase font-semibold"
            style={{ letterSpacing: "3px", color: `${accent}55` }}
          >
            Completed Sets
          </p>
          {state.sets.map((s) => (
            <div
              key={s.setNumber}
              className="flex items-center justify-between px-3 py-2"
              style={{
                backgroundColor: "#08080a",
                border: "1px solid #ffffff08",
              }}
            >
              <span
                className="text-xs font-semibold uppercase"
                style={{ color: `${accent}55`, letterSpacing: "1px" }}
              >
                Set {s.setNumber}
              </span>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: `${accent}cc` }}
              >
                {s.weight > 0 ? `${s.weight}kg × ` : ""}
                {s.reps} reps
                {s.rpe != null && (
                  <span
                    className="ml-2 text-xs font-semibold"
                    style={{ color: accent }}
                  >
                    RPE {s.rpe}
                  </span>
                )}
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
  onAdvance,
  isLastBlock,
}: {
  block: BlockData;
  state: BlockState;
  onToggleDrill: (idx: number) => void;
  onAdvance?: () => void;
  isLastBlock?: boolean;
}) {
  const accent = getBlockAccent(block);
  const cfg = parseConfig(block.config);
  // Drills can be strings (legacy) or objects { name, duration, notes } (from start-live)
  const rawDrills = (cfg.drills as Array<string | { name: string; duration?: number; notes?: string }>) ?? [];
  const drills = rawDrills.map((d) =>
    typeof d === "string" ? { name: d, duration: undefined as number | undefined } : d,
  );
  const duration = (cfg.duration ?? cfg.totalDuration) as number | undefined;

  const chamfer =
    "polygon(0 0,calc(100% - 3px) 0,100% 3px,100% 100%,3px 100%,0 calc(100% - 3px))";
  const chamferLg =
    "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))";

  return (
    <div className="space-y-4">
      {/* ── Duration Badge ── */}
      {duration && (
        <div className="text-center">
          <p
            className="text-[8px] uppercase font-semibold mb-0.5"
            style={{ letterSpacing: "4px", color: `${accent}44` }}
          >
            Duration
          </p>
          <span
            className="font-heading font-extrabold tabular-nums"
            style={{ fontSize: "32px", lineHeight: 1, color: accent }}
          >
            {duration}
          </span>
          <span
            className="ml-1 text-sm font-semibold"
            style={{ color: `${accent}66` }}
          >
            min
          </span>
        </div>
      )}

      {/* ── Drill Checklist ── */}
      {drills.length > 0 ? (
        <div className="space-y-2">
          <p
            className="text-[9px] uppercase font-semibold"
            style={{ letterSpacing: "3px", color: `${accent}55` }}
          >
            {block.blockType === "WARMUP" ? "Warm-Up Drills" : "Cool-Down Drills"}
          </p>
          {drills.map((drill, i) => {
            const checked = state.warmupChecked.has(i);
            return (
              <button
                key={i}
                onClick={() => onToggleDrill(i)}
                className="w-full flex items-center gap-3 px-3 py-3 text-left transition-all min-h-[52px]"
                style={{
                  backgroundColor: checked ? `${accent}11` : "#08080a",
                  border: `1px solid ${checked ? `${accent}33` : "#ffffff08"}`,
                  clipPath: chamfer,
                }}
              >
                {/* Checkbox */}
                <div
                  className="w-5 h-5 flex items-center justify-center shrink-0 transition-all"
                  style={{
                    backgroundColor: checked ? accent : "transparent",
                    border: `2px solid ${checked ? accent : `${accent}33`}`,
                    clipPath: chamfer,
                  }}
                >
                  {checked && (
                    <Check size={11} strokeWidth={2.5} style={{ color: "#000" }} aria-hidden="true" />
                  )}
                </div>
                {/* Drill text */}
                <div className="flex-1 min-w-0">
                  <span
                    className="text-sm font-medium transition-all block"
                    style={{
                      color: checked ? `${accent}55` : "#E8E8E8",
                      textDecoration: checked ? "line-through" : "none",
                    }}
                  >
                    {drill.name}
                  </span>
                  {drill.duration && (
                    <span
                      className="text-[10px] tabular-nums"
                      style={{ color: `${accent}44` }}
                    >
                      {drill.duration}min
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Progress indicator */}
          {drills.length > 0 && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1"
                style={{
                  backgroundColor: `${accent}11`,
                  border: `1px solid ${accent}22`,
                  clipPath: chamferLg,
                }}
              >
                <span
                  className="text-[9px] uppercase font-bold"
                  style={{ letterSpacing: "2px", color: `${accent}77` }}
                >
                  {state.warmupChecked.size} / {drills.length}
                </span>
              </div>
            </div>
          )}

          {/* CONTINUE button — shown when all drills checked */}
          {state.warmupChecked.size >= drills.length && drills.length > 0 && onAdvance && (
            <button
              onClick={onAdvance}
              className="w-full mt-4 py-4 text-sm font-bold tracking-widest animate-fade-slide-in"
              style={{
                background: isLastBlock ? "#00FF88" : accent,
                color: "#000",
                clipPath: chamferLg,
              }}
            >
              {isLastBlock ? "FINISH SESSION" : "CONTINUE →"}
            </button>
          )}
        </div>
      ) : (
        <div
          className="text-center py-6"
          style={{
            backgroundColor: "#08080a",
            border: "1px solid #ffffff08",
            clipPath: chamferLg,
          }}
        >
          <p
            className="text-xs font-medium uppercase"
            style={{ letterSpacing: "2px", color: `${accent}66` }}
          >
            Complete your {block.blockType.toLowerCase()} routine
          </p>
        </div>
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
  sessionName,
}: {
  assignmentId: string;
  blockStates: Map<string, BlockState>;
  elapsed: number;
  sessionName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rpe, setRpe] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<string>("GOOD");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Aggregate stats — null-guarded
  const allThrows = [...blockStates.values()].flatMap((s) => s.throws);
  const markedThrows = allThrows.filter((t) => t.distance !== null);
  const bestMark =
    markedThrows.length > 0
      ? Math.max(...markedThrows.map((t) => t.distance as number))
      : 0;
  const totalThrowCount = allThrows.length;
  const markedCount = markedThrows.length;

  const allSets = [...blockStates.values()].flatMap((s) => s.sets);
  const totalVolume = allSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

  const chamfer =
    "polygon(0 0,calc(100% - 3px) 0,100% 3px,100% 100%,3px 100%,0 calc(100% - 3px))";
  const chamferLg =
    "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))";

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
      router.refresh();
      router.push("/athlete/self-program");
    } catch {
      toast("Network error", "error");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Hero Text ── */}
      <div className="text-center pt-4 pb-2 space-y-2">
        <p
          className="text-[8px] uppercase font-semibold"
          style={{ letterSpacing: "4px", color: "#00FF8888" }}
        >
          Session Complete
        </p>
        <h2
          className="text-2xl font-heading font-bold"
          style={{
            color: "#FFC800",
            textShadow: "0 0 32px #FFC80055, 0 0 64px #FFC80022",
          }}
        >
          {sessionName}
        </h2>
      </div>

      {/* ── Stat Cards 2×2 ── */}
      <div className="grid grid-cols-2 gap-2">
        {/* Total Throws */}
        <div
          className="p-3 text-center"
          style={{
            backgroundColor: "#08080a",
            border: "1px solid #1a1a1e",
            clipPath: chamferLg,
          }}
        >
          <p
            className="text-[8px] uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Total Throws
          </p>
          <span style={{ color: "#FFC800" }}>
            <AnimatedNumber
              value={totalThrowCount}
              className="text-xl font-heading font-bold tabular-nums"
            />
          </span>
        </div>

        {/* Marked Throws */}
        <div
          className="p-3 text-center"
          style={{
            backgroundColor: "#08080a",
            border: "1px solid #1a1a1e",
            clipPath: chamferLg,
          }}
        >
          <p
            className="text-[8px] uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Marked
          </p>
          <span style={{ color: "#FFC800" }}>
            <AnimatedNumber
              value={markedCount}
              className="text-xl font-heading font-bold tabular-nums"
            />
          </span>
        </div>

        {/* Best Mark */}
        <div
          className="p-3 text-center"
          style={{
            backgroundColor: "#08080a",
            border: "1px solid #1a1a1e",
            clipPath: chamferLg,
          }}
        >
          <p
            className="text-[8px] uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Best Mark
          </p>
          {bestMark > 0 ? (
            <span
              className="text-xl font-heading font-bold tabular-nums"
              style={{ color: "#FFC800" }}
            >
              <AnimatedNumber value={bestMark} decimals={2} className="text-xl font-heading font-bold tabular-nums" />
              <span className="text-sm font-semibold ml-0.5" style={{ color: "#FFC80088" }}>m</span>
            </span>
          ) : (
            <span
              className="text-xl font-heading font-bold"
              style={{ color: "#FFC80044" }}
            >
              —
            </span>
          )}
        </div>

        {/* Duration */}
        <div
          className="p-3 text-center"
          style={{
            backgroundColor: "#08080a",
            border: "1px solid #1a1a1e",
            clipPath: chamferLg,
          }}
        >
          <p
            className="text-[8px] uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Duration
          </p>
          <p
            className="text-xl font-heading font-bold tabular-nums"
            style={{ color: "#FFC800" }}
          >
            {formatElapsed(elapsed)}
          </p>
        </div>
      </div>

      {/* Volume row — only if strength work logged */}
      {totalVolume > 0 && (
        <div
          className="p-3 text-center"
          style={{
            backgroundColor: "#08080a",
            border: "1px solid #1a1a1e",
            clipPath: chamferLg,
          }}
        >
          <p
            className="text-[8px] uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Strength Volume
          </p>
          <p
            className="text-xl font-heading font-bold tabular-nums"
            style={{ color: "#FFC800" }}
          >
            {totalVolume.toLocaleString()}
            <span className="text-sm font-semibold ml-0.5" style={{ color: "#FFC80088" }}>kg</span>
          </p>
        </div>
      )}

      {/* ── RPE Slider ── */}
      <div className="space-y-2">
        <label
          className="text-[9px] uppercase font-semibold block"
          style={{ letterSpacing: "3px", color: "#888" }}
        >
          Session RPE —{" "}
          <span style={{ color: "#FFC800" }}>{rpe ?? "—"}</span>
        </label>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={rpe ?? 5}
          onChange={(e) => setRpe(parseInt(e.target.value))}
          className="w-full h-2 appearance-none cursor-pointer"
          style={{
            accentColor: "#FFC800",
            background: rpe != null
              ? `linear-gradient(to right, #FFC800 ${(rpe - 1) * 11.1}%, #1a1a1e ${(rpe - 1) * 11.1}%)`
              : "#1a1a1e",
          }}
        />
        <div className="flex justify-between">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
            <span
              key={v}
              className="text-[9px] font-semibold tabular-nums"
              style={{ color: v === rpe ? "#FFC800" : "#444" }}
            >
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* ── Feeling Selector ── */}
      <div className="space-y-2">
        <label
          className="text-[9px] uppercase font-semibold block"
          style={{ letterSpacing: "3px", color: "#888" }}
        >
          How did you feel?
        </label>
        <div className="flex gap-1.5">
          {FEELING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFeeling(opt.value)}
              className="flex-1 py-2 text-xs font-medium transition-all min-h-[52px] flex flex-col items-center gap-0.5"
              style={{
                backgroundColor:
                  feeling === opt.value ? "#FFC80008" : "#08080a",
                border: `1px solid ${feeling === opt.value ? "#FFC800" : "#1a1a1e"}`,
                color: feeling === opt.value ? "#FFC800" : "#666",
                clipPath: chamfer,
              }}
            >
              <span className="text-base leading-tight">{opt.emoji}</span>
              <span className="text-[9px] uppercase font-semibold" style={{ letterSpacing: "1px" }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="space-y-2">
        <label
          className="text-[9px] uppercase font-semibold block"
          style={{ letterSpacing: "3px", color: "#888" }}
        >
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any observations, aches, or breakthroughs..."
          className="w-full px-3 py-3 text-sm resize-none focus:outline-none transition-colors"
          style={{
            backgroundColor: "#08080a",
            border: "1px solid #1a1a1e",
            color: "#E8E8E8",
          }}
        />
      </div>

      {/* ── Submit ── */}
      <div className="sm:hidden">
        <SlideToConfirm
          label="Slide to Submit Session"
          onConfirm={submit}
          disabled={submitting}
          variant="confirm"
        />
      </div>
      <div className="hidden sm:block">
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full min-h-[52px] font-bold text-[11px] uppercase disabled:opacity-40 transition-opacity"
          style={{
            letterSpacing: "3px",
            backgroundColor: "#FFC800",
            color: "#000",
            clipPath: chamferLg,
          }}
        >
          {submitting ? "Submitting..." : "Submit Session"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  WORKOUT OVERVIEW (all blocks at a glance)                              */
/* ═══════════════════════════════════════════════════════════════════════ */

function WorkoutOverview({ data, blockStates }: { data: WorkoutData; blockStates: Map<string, BlockState> }) {
  const chamferLg =
    "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))";

  return (
    <div className="space-y-6 pb-8">
      {/* Session title */}
      <div className="text-center pt-2">
        <h2
          className="text-lg font-heading font-bold tracking-wider"
          style={{ color: "#FFC800" }}
        >
          {data.sessionName}
        </h2>
        <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "#ffffff33" }}>
          {data.sessionType.replace(/_/g, " ")} · {data.event.replace(/_/g, " ")}
        </p>
      </div>

      {/* Quick stats */}
      <div className="flex justify-center gap-4">
        <div className="text-center">
          <span className="text-xl font-bold tabular-nums" style={{ color: "#FFC800" }}>
            {data.blocks.length}
          </span>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "#ffffff44" }}>
            Blocks
          </p>
        </div>
        <div className="text-center">
          {(() => {
            const loggedThrows = Array.from(blockStates.values())
              .reduce((sum, s) => sum + s.throws.filter((t) => t.distance !== null && t.distance > 0).length, 0);
            const totalThrows = data.blocks
              .filter((b) => b.blockType === "THROWING")
              .reduce((sum, b) => sum + getThrowCount(parseConfig(b.config)), 0);
            return (
              <>
                <span className="text-xl font-bold tabular-nums" style={{ color: loggedThrows > 0 ? "#00FF88" : "#FFC800" }}>
                  {loggedThrows}
                </span>
                <span className="text-sm font-medium tabular-nums" style={{ color: "#ffffff33" }}>
                  /{totalThrows}
                </span>
              </>
            );
          })()}
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "#ffffff44" }}>
            Throws Logged
          </p>
        </div>
        <div className="text-center">
          <span className="text-xl font-bold tabular-nums" style={{ color: "#FFC800" }}>
            {Array.from(blockStates.values()).reduce((sum, s) => sum + s.sets.length, 0)}
          </span>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "#ffffff44" }}>
            Sets
          </p>
        </div>
      </div>

      {/* All blocks */}
      {data.blocks.map((block, i) => {
        const cfg = parseConfig(block.config);
        const accent = getBlockAccent(block);
        const bt = block.blockType.toUpperCase();
        const state = blockStates.get(block.id);
        const loggedCount = state ? state.throws.length + state.sets.length + state.warmupChecked.size : 0;
        const hasProgress = loggedCount > 0;

        return (
          <div key={block.id} className="space-y-2">
            {/* Block header */}
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-sm" style={{ background: accent }} />
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: accent }}
              >
                {bt === "THROWING"
                  ? getExerciseName(block)
                  : bt}
              </span>
              <span className="text-[9px] text-white/30 ml-auto flex items-center gap-1.5">
                {hasProgress && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                )}
                Block {i + 1}
              </span>
            </div>

            {/* Block content */}
            <div
              className="px-4 py-3 space-y-2"
              style={{
                backgroundColor: "#08080a",
                border: `1px solid ${accent}22`,
                clipPath: chamferLg,
              }}
            >
              {bt === "WARMUP" || bt === "COOLDOWN" ? (
                <>
                  {((cfg.drills as Array<string | { name: string; duration?: number }>) ?? []).map(
                    (d, j) => {
                      const name = typeof d === "string" ? d : d.name;
                      const dur = typeof d === "object" ? d.duration : undefined;
                      return (
                        <div key={j} className="flex items-center justify-between">
                          <span className="text-sm" style={{ color: "#E8E8E8" }}>
                            {name}
                          </span>
                          {dur && (
                            <span className="text-[10px] tabular-nums" style={{ color: `${accent}44` }}>
                              {dur}min
                            </span>
                          )}
                        </div>
                      );
                    },
                  )}
                  {(cfg.totalDuration ?? cfg.duration) && (
                    <div className="flex justify-end pt-1">
                      <span className="text-xs font-semibold tabular-nums" style={{ color: `${accent}88` }}>
                        {String(cfg.totalDuration ?? cfg.duration)} min total
                      </span>
                    </div>
                  )}
                </>
              ) : bt === "THROWING" ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium" style={{ color: "#E8E8E8" }}>
                      {getImplement(cfg) || `${getImplementKg(cfg)}kg`}
                    </span>
                    <span
                      className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${accent}22`, color: accent }}
                    >
                      {(cfg.classification as string) ?? ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums" style={{ color: accent }}>
                      {getThrowCount(cfg)}
                    </span>
                    <span className="text-xs ml-1" style={{ color: `${accent}66` }}>
                      throws
                    </span>
                    {getRestSeconds(cfg) > 0 && (
                      <p className="text-[10px] tabular-nums" style={{ color: "#ffffff33" }}>
                        {getRestSeconds(cfg)}s rest
                      </p>
                    )}
                  </div>
                </div>
              ) : bt === "STRENGTH" ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "#E8E8E8" }}>
                    {(cfg.exerciseName as string) ?? "Strength"}
                  </span>
                  <div className="text-right text-xs tabular-nums" style={{ color: `${accent}88` }}>
                    {(cfg.sets as number) ?? 0} × {(cfg.reps as number) ?? 0}
                    {(cfg.loadKg as number) ? ` @ ${cfg.loadKg}kg` : ""}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
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

  // View mode toggle: overview shows all blocks, live shows one-at-a-time
  const [viewMode, setViewMode] = useState<"overview" | "live">("live");

  // Block navigation
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showBlockTransition, setShowBlockTransition] = useState(false);
  const totalBlocks = data.blocks.length;
  const activeBlock = data.blocks[activeBlockIdx];

  // Block states — reconstruct from persisted logs on reload
  const [blockStates, setBlockStates] = useState<Map<string, BlockState>>(() => {
    const map = new Map<string, BlockState>();
    for (const block of data.blocks) {
      const blockLogs = data.existingThrowLogs.filter((tl) => tl.blockId === block.id);
      const bt = block.blockType?.toUpperCase();

      // Reconstruct warmup drill checks from persisted logs
      const warmupChecked = new Set<number>();
      // Reconstruct strength sets from persisted logs
      const sets: LoggedSet[] = [];
      // Regular throws (non-warmup, non-strength)
      const throws: LoggedThrow[] = [];

      for (const tl of blockLogs) {
        let parsed: Record<string, unknown> | null = null;
        try { parsed = tl.notes ? JSON.parse(tl.notes) : null; } catch { /* not JSON */ }

        if (parsed?.type === "warmup_drill") {
          warmupChecked.add(tl.throwNumber);
        } else if (parsed?.type === "strength") {
          sets.push({
            setNumber: tl.throwNumber,
            reps: (parsed.reps as number) || 0,
            weight: tl.distance ?? 0,
            rpe: (parsed.rpe as number) || null,
          });
        } else if (bt === "THROWING" || bt === "PLYOMETRIC") {
          throws.push({
            throwNumber: tl.throwNumber,
            distance: tl.distance ?? 0,
            id: tl.id,
          });
        } else {
          // Default: treat as throw data
          throws.push({
            throwNumber: tl.throwNumber,
            distance: tl.distance ?? 0,
            id: tl.id,
          });
        }
      }

      map.set(block.id, {
        throws,
        sets,
        warmupChecked,
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

  // Handlers
  const handleThrowLogged = useCallback(
    (blockId: string, t: LoggedThrow) => {
      setBlockStates((prev) => {
        const next = new Map(prev);
        const state = { ...next.get(blockId)! };
        state.throws = [...state.throws, t];

        // Check if this throwing block just completed
        const block = data.blocks.find((b) => b.id === blockId);
        if (block) {
          const cfg = parseConfig(block.config);
          const target = getThrowCount(cfg);
          if (state.throws.length >= target) {
            const blockIdx = data.blocks.indexOf(block);
            if (blockIdx < data.blocks.length - 1) {
              // There's a next block — show transition card
              setShowBlockTransition(true);
            }
          }
        }

        next.set(blockId, state);
        return next;
      });
    },
    [data.blocks],
  );

  const handleSetLogged = useCallback(
    (blockId: string, s: LoggedSet) => {
      setBlockStates((prev) => {
        const next = new Map(prev);
        const state = { ...next.get(blockId)! };
        state.sets = [...state.sets, s];
        next.set(blockId, state);

        // Check if this strength block just completed
        const block = data.blocks.find((b) => b.id === blockId);
        if (block) {
          const cfg = parseConfig(block.config);
          const exercises = (cfg.exercises as Array<Record<string, unknown>>) ?? [];
          const targetSets = (exercises[0]?.sets as number) || (cfg.sets as number) || 0;
          if (targetSets > 0 && state.sets.length >= targetSets) {
            const blockIdx = data.blocks.indexOf(block);
            if (blockIdx < data.blocks.length - 1) {
              setShowBlockTransition(true);
            }
          }
        }

        return next;
      });
    },
    [data.blocks],
  );

  const handleToggleDrill = useCallback(
    (blockId: string, idx: number) => {
      setBlockStates((prev) => {
        const next = new Map(prev);
        const state = { ...next.get(blockId)! };
        const checked = new Set(state.warmupChecked);
        const isChecking = !checked.has(idx);
        if (isChecking) checked.add(idx);
        else checked.delete(idx);
        state.warmupChecked = checked;
        next.set(blockId, state);

        // Persist drill check to DB (fire-and-forget)
        if (isChecking) {
          fetch(`/api/throws/assignments/${data.assignmentId}/log-throw`, {
            method: "POST",
            headers: csrfHeaders(),
            body: JSON.stringify({
              blockId,
              distance: null,
              implement: "warmup",
              throwNumber: idx,
              notes: JSON.stringify({ type: "warmup_drill", checked: true }),
            }),
          }).catch(() => {});
        }

        return next;
      });
    },
    [data.assignmentId],
  );

  async function endEarly() {
    try {
      const res = await fetch(`/api/throws/assignments/${data.assignmentId}`, {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "partial" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast(errData.error || "Failed to end session", "error");
        return;
      }
      toast("Session ended", "info");
      router.push("/athlete/self-program");
    } catch {
      toast("Network error", "error");
    }
  }

  const handleEndSession = useCallback(() => {
    if (confirm("End session early? Your logged throws are saved.")) {
      endEarly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived values for header
  const accent = activeBlock ? getBlockAccent(activeBlock) : "#FFC800";
  const blockLabel = activeBlock ? getBlockLabel(activeBlock) : "";
  const exerciseName = activeBlock ? getExerciseName(activeBlock) : "";

  const currentState = blockStates.get(activeBlock?.id) ?? {
    throws: [], sets: [], warmupChecked: new Set<number>(), completed: false,
  };

  const bt = activeBlock?.blockType?.toUpperCase();

  // Completion screen — full-screen dramatic wrapper
  if (showCompletion) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0a0a0c] relative">
        {/* Scanline overlay */}
        <div
          className="pointer-events-none fixed inset-0 z-50 mix-blend-overlay opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 1px,rgba(255,200,0,0.1) 1px,rgba(255,200,0,0.1) 2px)",
          }}
        />

        {/* Back header */}
        <div className="sticky top-0 z-10 px-5 pt-14 pb-3 bg-[#0a0a0c]">
          <button
            onClick={() => setShowCompletion(false)}
            className="text-xs text-white/50 flex items-center gap-1 min-h-[44px]"
          >
            <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" /> BACK TO BLOCKS
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 px-5">
          <CompletionScreen
            assignmentId={data.assignmentId}
            blockStates={blockStates}
            elapsed={elapsed}
            sessionName={data.sessionName}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0c] relative">
      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 mix-blend-overlay opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 1px,rgba(255,200,0,0.1) 1px,rgba(255,200,0,0.1) 2px)",
        }}
      />

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-10 px-5 pt-14 pb-3 bg-[#0a0a0c]">
        <div className="flex items-center justify-between">
          {/* End Session — left */}
          <button
            onClick={handleEndSession}
            className="text-xs text-white/50 flex items-center gap-1 min-h-[44px]"
          >
            <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" /> FINISH EARLY
          </button>

          {/* Classification badge — center */}
          <div className="flex items-center gap-2">
            <div
              className="w-1 h-5 rounded-sm"
              style={{ background: accent }}
            />
            <span
              className="text-[10px] font-bold tracking-widest"
              style={{ color: accent }}
            >
              {blockLabel}
            </span>
          </div>

          {/* Live indicator + timer — right */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] tracking-widest font-semibold text-emerald-500/60">
              ● LIVE
            </span>
            <span className="text-xs tabular-nums text-white/50">
              {formatElapsed(elapsed)}
            </span>
          </div>
        </div>

        {/* ── Overview / Live Toggle ── */}
        <div className="flex gap-1 mt-3 bg-[#111117] rounded-lg p-1">
          <button
            type="button"
            onClick={() => setViewMode("overview")}
            className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all min-h-[40px]"
            style={{
              backgroundColor: viewMode === "overview" ? "#FFC800" : "transparent",
              color: viewMode === "overview" ? "#000" : "#ffffff55",
            }}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setViewMode("live")}
            className="flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all min-h-[40px]"
            style={{
              backgroundColor: viewMode === "live" ? "#FFC800" : "transparent",
              color: viewMode === "live" ? "#000" : "#ffffff55",
            }}
          >
            Live
          </button>
        </div>
      </div>

      {/* ── Overview Mode ── */}
      {viewMode === "overview" ? (
        <div className="flex-1 overflow-y-auto pb-20 px-5">
          <WorkoutOverview data={data} blockStates={blockStates} />
        </div>
      ) : (
      <>
      {/* ── Block Indicator with Nav Arrows ── */}
      <div className="flex items-center justify-center gap-4 py-2 px-5">
        {activeBlockIdx > 0 && (
          <button
            onClick={() => { setShowBlockTransition(false); setActiveBlockIdx((i) => i - 1); }}
            className="text-white/30 text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ‹
          </button>
        )}
        <div className="text-center flex-1">
          <div className="text-[9px] text-white/30 tracking-widest font-semibold uppercase">
            Block {activeBlockIdx + 1} / {totalBlocks}
          </div>
          <h1
            className="text-[22px] font-heading font-bold tracking-wider"
            style={{ color: accent }}
          >
            {exerciseName}
          </h1>
        </div>
        {activeBlockIdx < totalBlocks - 1 && (
          <button
            onClick={() => setActiveBlockIdx((i) => i + 1)}
            className="text-white/30 text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ›
          </button>
        )}
      </div>

      {/* ── Block Content Area ── */}
      <div className="flex-1 overflow-y-auto pb-20 px-5">
        {/* Block transition card */}
        {showBlockTransition && activeBlockIdx < totalBlocks - 1 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-7 py-20">
            <div
              className="text-[8px] tracking-[4px] font-semibold"
              style={{ color: "#00FF8888" }}
            >
              BLOCK COMPLETE
            </div>
            <div
              className="text-lg font-heading font-bold tracking-wider mt-3"
              style={{ color: accent }}
            >
              Next: {getExerciseName(data.blocks[activeBlockIdx + 1])}
            </div>
            <button
              onClick={() => {
                setShowBlockTransition(false);
                setActiveBlockIdx((i) => i + 1);
              }}
              className="mt-6 w-full py-4 text-sm font-bold tracking-widest"
              style={{
                background: accent,
                color: "#000",
                clipPath:
                  "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))",
              }}
            >
              CONTINUE
            </button>
          </div>
        ) : (
          <>
            {bt === "THROWING" && (
              <ThrowingBlockView
                block={activeBlock}
                state={currentState}
                assignmentId={data.assignmentId}
                event={data.event}
                onThrowLogged={(t) => handleThrowLogged(activeBlock.id, t)}
              />
            )}
            {bt === "STRENGTH" && (
              <StrengthBlockView
                block={activeBlock}
                state={currentState}
                onSetLogged={(s) => handleSetLogged(activeBlock.id, s)}
                assignmentId={data.assignmentId}
              />
            )}
            {(bt === "WARMUP" || bt === "COOLDOWN") && (
              <WarmupCooldownView
                block={activeBlock}
                state={currentState}
                onToggleDrill={(idx) => handleToggleDrill(activeBlock.id, idx)}
                onAdvance={
                  activeBlockIdx < totalBlocks - 1
                    ? () => setActiveBlockIdx((i) => i + 1)
                    : () => setShowCompletion(true)
                }
                isLastBlock={activeBlockIdx === totalBlocks - 1}
              />
            )}
          </>
        )}

        {/* ── Bottom Nav: Finish Button (last block only) ── */}
        {!showBlockTransition && activeBlockIdx === totalBlocks - 1 && (
          <div className="mt-8 px-2">
            <button
              onClick={() => setShowCompletion(true)}
              className="w-full py-4 text-sm font-bold tracking-widest"
              style={{
                background: "#00FF88",
                color: "#000",
                clipPath:
                  "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))",
              }}
            >
              FINISH SESSION
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
