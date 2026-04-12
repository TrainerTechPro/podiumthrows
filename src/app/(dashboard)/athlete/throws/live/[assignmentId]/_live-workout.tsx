"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { WorkoutData, LoggedThrow, LoggedSet, BlockState } from "./_types";
import {
  parseConfig,
  getThrowCount,
  getBlockAccent,
  getBlockLabel,
  getExerciseName,
  useElapsedTime,
  formatElapsed,
} from "./_utils";
import { ThrowingBlockView } from "./_throwing-block";
import { StrengthBlockView } from "./_strength-block";
import { WarmupCooldownView } from "./_warmup-block";
import { CompletionScreen } from "./_completion-view";
import { WorkoutOverview } from "./_workout-overview";

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
