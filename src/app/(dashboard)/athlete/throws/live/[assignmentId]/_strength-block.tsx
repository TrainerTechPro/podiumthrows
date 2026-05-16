"use client";

import { useState } from "react";
import { RestTimer } from "@/components";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { BlockData, BlockState, LoggedSet } from "./_types";
import { parseConfig, getRestSeconds, getBlockAccent, CHAMFER_LG } from "./_utils";
import { logger } from "@/lib/logger";

/* ═══════════════════════════════════════════════════════════════════════ */
/*  STRENGTH BLOCK VIEW                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

export function StrengthBlockView({
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

  async function logSet() {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!r || r <= 0) {
      toast("Enter reps completed", "error");
      return;
    }

    setLogging(true);
    const setNumber = state.sets.length + 1;
    const exerciseName = (exercises[0]?.exerciseName as string) || "Strength";

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
    } catch (err) {
      // Best-effort — still advance locally
      logger.debug("Best-effort — still advance locally", {
        context: "src/app/(dashboard)/athlete/throws/live/[assignmentId]/_strength-block.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
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
          className="text-nano uppercase font-semibold mb-1"
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
            clipPath: CHAMFER_LG,
          }}
        >
          <p
            className="text-nano uppercase font-semibold"
            style={{ letterSpacing: "3px", color: `${accent}66` }}
          >
            Prescribed
          </p>
          {exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-lg font-heading font-bold" style={{ color: accent }}>
                {(ex.name as string) || "Exercise"}
              </span>
              <span className="text-sm tabular-nums font-medium" style={{ color: `${accent}99` }}>
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
          clipPath: CHAMFER_LG,
        }}
      >
        <p
          className="text-nano uppercase font-semibold"
          style={{ letterSpacing: "3px", color: `${accent}66` }}
        >
          Log Set {state.sets.length + 1}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="text-nano uppercase font-semibold mb-1.5 block"
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
              className="text-nano uppercase font-semibold mb-1.5 block"
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
            className="text-nano uppercase font-semibold mb-2 block"
            style={{ letterSpacing: "2px", color: `${accent}66` }}
          >
            RPE {rpe !== null && <span style={{ color: accent }}>— {rpe}</span>}
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
          className="w-full min-h-[52px] font-bold text-micro uppercase disabled:opacity-40 transition-opacity"
          style={{
            letterSpacing: "3px",
            backgroundColor: accent,
            color: "#000",
            clipPath: CHAMFER_LG,
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
            className="text-nano uppercase font-semibold"
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
              <span className="text-sm font-bold tabular-nums" style={{ color: `${accent}cc` }}>
                {s.weight > 0 ? `${s.weight}kg × ` : ""}
                {s.reps} reps
                {s.rpe != null && (
                  <span className="ml-2 text-xs font-semibold" style={{ color: accent }}>
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
