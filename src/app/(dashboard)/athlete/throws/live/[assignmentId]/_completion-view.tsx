"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedNumber } from "@/components";
import { SlideToConfirm } from "@/components/ui/SlideToConfirm";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { BlockState } from "./_types";
import { formatElapsed, FEELING_OPTIONS, CHAMFER, CHAMFER_LG } from "./_utils";

/* ═══════════════════════════════════════════════════════════════════════ */
/*  COMPLETION SCREEN                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

export function CompletionScreen({
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
    markedThrows.length > 0 ? Math.max(...markedThrows.map((t) => t.distance as number)) : 0;
  const totalThrowCount = allThrows.length;
  const markedCount = markedThrows.length;

  const allSets = [...blockStates.values()].flatMap((s) => s.sets);
  const totalVolume = allSets.reduce((sum, s) => sum + s.weight * s.reps, 0);

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
          className="text-nano uppercase font-semibold"
          style={{ letterSpacing: "4px", color: "#00FF8888" }}
        >
          Session Complete
        </p>
        <h2
          className="text-2xl font-heading font-bold"
          style={{
            color: "var(--color-brand)",
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
            clipPath: CHAMFER_LG,
          }}
        >
          <p
            className="text-nano uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Total Throws
          </p>
          <span style={{ color: "var(--color-brand)" }}>
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
            clipPath: CHAMFER_LG,
          }}
        >
          <p
            className="text-nano uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Marked
          </p>
          <span style={{ color: "var(--color-brand)" }}>
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
            clipPath: CHAMFER_LG,
          }}
        >
          <p
            className="text-nano uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Best Mark
          </p>
          {bestMark > 0 ? (
            <span
              className="text-xl font-heading font-bold tabular-nums"
              style={{ color: "var(--color-brand)" }}
            >
              <AnimatedNumber
                value={bestMark}
                decimals={2}
                className="text-xl font-heading font-bold tabular-nums"
              />
              <span className="text-sm font-semibold ml-0.5" style={{ color: "#FFC80088" }}>
                m
              </span>
            </span>
          ) : (
            <span className="text-xl font-heading font-bold" style={{ color: "#FFC80044" }}>
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
            clipPath: CHAMFER_LG,
          }}
        >
          <p
            className="text-nano uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Duration
          </p>
          <p
            className="text-xl font-heading font-bold tabular-nums"
            style={{ color: "var(--color-brand)" }}
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
            clipPath: CHAMFER_LG,
          }}
        >
          <p
            className="text-nano uppercase font-semibold mb-1"
            style={{ letterSpacing: "2px", color: "#555" }}
          >
            Strength Volume
          </p>
          <p
            className="text-xl font-heading font-bold tabular-nums"
            style={{ color: "var(--color-brand)" }}
          >
            {totalVolume.toLocaleString()}
            <span className="text-sm font-semibold ml-0.5" style={{ color: "#FFC80088" }}>
              kg
            </span>
          </p>
        </div>
      )}

      {/* ── RPE Slider ── */}
      <div className="space-y-2">
        <label
          className="text-nano uppercase font-semibold block"
          style={{ letterSpacing: "3px", color: "#888" }}
        >
          Session RPE — <span style={{ color: "var(--color-brand)" }}>{rpe ?? "—"}</span>
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
            accentColor: "var(--color-brand)",
            background:
              rpe != null
                ? `linear-gradient(to right, #FFC800 ${(rpe - 1) * 11.1}%, #1a1a1e ${(rpe - 1) * 11.1}%)`
                : "#1a1a1e",
          }}
        />
        <div className="flex justify-between">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
            <span
              key={v}
              className="text-nano font-semibold tabular-nums"
              style={{ color: v === rpe ? "var(--color-brand)" : "#444" }}
            >
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* ── Feeling Selector ── */}
      <div className="space-y-2">
        <label
          className="text-nano uppercase font-semibold block"
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
                backgroundColor: feeling === opt.value ? "#FFC80008" : "#08080a",
                border: `1px solid ${feeling === opt.value ? "var(--color-brand)" : "#1a1a1e"}`,
                color: feeling === opt.value ? "var(--color-brand)" : "#666",
                clipPath: CHAMFER,
              }}
            >
              <span className="text-base leading-tight">{opt.emoji}</span>
              <span className="text-nano uppercase font-semibold" style={{ letterSpacing: "1px" }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="space-y-2">
        <label
          className="text-nano uppercase font-semibold block"
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
          className="w-full min-h-[52px] font-bold text-micro uppercase disabled:opacity-40 transition-opacity"
          style={{
            letterSpacing: "3px",
            backgroundColor: "var(--color-brand)",
            color: "#000",
            clipPath: CHAMFER_LG,
          }}
        >
          {submitting ? "Submitting..." : "Submit Session"}
        </button>
      </div>
    </div>
  );
}
