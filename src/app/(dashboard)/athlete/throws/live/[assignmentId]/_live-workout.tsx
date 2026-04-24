"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, ChevronRight } from "lucide-react";
import { useToast } from "@/components/toast";
import { csrfHeaders } from "@/lib/csrf-client";
import type { WorkoutData, LoggedThrow, LoggedSet, BlockState } from "./_types";
import {
  parseConfig,
  getThrowCount,
  getBlockAccent,
  getExerciseName,
  getImplement,
  getImplementKg,
  useElapsedTime,
  formatElapsed,
} from "./_utils";
import { ThrowingBlockView } from "./_throwing-block";
import { StrengthBlockView } from "./_strength-block";
import { WarmupCooldownView } from "./_warmup-block";
import { CompletionScreen } from "./_completion-view";
import { TimelineProgressDots } from "./_timeline-progress-dots";
import { logger } from "@/lib/logger";

/* ═══════════════════════════════════════════════════════════════════════ */
/*  TIMELINE NODE WRAPPER                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */

type NodeState = "locked" | "ready" | "active" | "completed";

function TimelineNode({
  nodeState,
  accent,
  title,
  subtitle,
  summaryLine,
  isLast,
  onTap,
  children,
}: {
  nodeState: NodeState;
  accent: string;
  title: string;
  subtitle?: string;
  summaryLine?: string;
  isLast?: boolean;
  onTap?: () => void;
  children?: React.ReactNode;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active node
  useEffect(() => {
    if (nodeState === "active" && nodeRef.current) {
      // Small delay to let expand animation start
      const t = setTimeout(() => {
        nodeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [nodeState]);

  const isExpanded = nodeState === "active";
  const isCompleted = nodeState === "completed";
  const isLocked = nodeState === "locked";
  // "ready" nodes are the next-in-sequence: they should look and feel
  // tappable (full opacity, pointer cursor, chevron visible), unlike
  // locked nodes which are dimmed and disabled.
  const isPending = isLocked;

  return (
    <div ref={nodeRef} className="relative flex gap-4">
      {/* ── Timeline dot + connector line ── */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 24 }}>
        {/* Dot */}
        <div
          className={isExpanded ? "timeline-dot-pulse" : ""}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            marginTop: 14,
            backgroundColor: isCompleted
              ? "#00FF88"
              : isExpanded
                ? accent
                : "rgba(255,255,255,0.08)",
            boxShadow: isCompleted
              ? "0 0 8px #00FF8844"
              : isExpanded
                ? `0 0 10px ${accent}44`
                : "none",
            transition: "background-color 0.4s ease, box-shadow 0.4s ease",
            flexShrink: 0,
          }}
        />
        {/* Connector line */}
        {!isLast && (
          <div
            style={{
              width: 2,
              flex: 1,
              minHeight: 16,
              backgroundColor: isCompleted ? "#00FF8833" : "rgba(255,255,255,0.03)",
              transition: "background-color 0.6s ease",
            }}
          />
        )}
      </div>

      {/* ── Node card ── */}
      <div
        className="flex-1 min-w-0 mb-3"
        style={{ opacity: isPending ? 0.4 : 1, transition: "opacity 0.3s ease" }}
      >
        {/* Collapsed / Completed header — always visible */}
        <button
          type="button"
          onClick={onTap}
          disabled={isPending}
          className="w-full text-left rounded-xl px-4 py-3 transition-all"
          style={{
            backgroundColor: isExpanded
              ? "transparent"
              : isCompleted
                ? "rgba(0,255,136,0.04)"
                : "#0c0c10",
            minHeight: 48,
            cursor: isPending ? "default" : "pointer",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: isCompleted ? "#00FF88cc" : isExpanded ? accent : "#E8E8E8" }}
              >
                {isCompleted && (
                  <Check
                    size={14}
                    strokeWidth={2}
                    className="inline mr-1.5 -mt-0.5"
                    style={{ color: "#00FF88" }}
                    aria-hidden="true"
                  />
                )}
                {title}
              </p>
              {subtitle && !isExpanded && (
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {subtitle}
                </p>
              )}
            </div>
            {!isExpanded && !isPending && (
              <ChevronRight
                size={14}
                strokeWidth={1.75}
                style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}
                aria-hidden="true"
              />
            )}
          </div>
          {/* Summary line for completed nodes */}
          {isCompleted && summaryLine && (
            <p className="text-[11px] mt-1 font-mono tabular-nums" style={{ color: "#00FF8888" }}>
              {summaryLine}
            </p>
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div
            className="mt-2 rounded-xl px-4 py-5 timeline-node-expanded"
            style={{
              background: `linear-gradient(165deg, ${accent}08, transparent 60%)`,
              boxShadow: `0 2px 40px ${accent}0a, 0 20px 60px rgba(0,0,0,0.3)`,
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  BLOCK GROUP LABEL                                                      */
/* ═══════════════════════════════════════════════════════════════════════ */

function BlockGroupLabel({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-3 pl-10 py-3">
      <div style={{ width: 16, height: 1, backgroundColor: `${color}44` }} />
      <span
        className="text-[10px] font-semibold uppercase"
        style={{ letterSpacing: "0.2em", color: `${color}88` }}
      >
        {label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  MAIN LIVE WORKOUT — TIMELINE LAYOUT                                    */
/* ═══════════════════════════════════════════════════════════════════════ */

export function LiveWorkout({ data }: { data: WorkoutData }) {
  const router = useRouter();
  const { toast } = useToast();
  const elapsed = useElapsedTime(data.startedAt ?? new Date().toISOString());

  // Which block is expanded (null = none, show completion at bottom)
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);

  // Block states — reconstruct from persisted logs on reload
  const [blockStates, setBlockStates] = useState<Map<string, BlockState>>(() => {
    const map = new Map<string, BlockState>();
    for (const block of data.blocks) {
      const blockLogs = data.existingThrowLogs.filter((tl) => tl.blockId === block.id);
      const bt = block.blockType?.toUpperCase();

      const warmupChecked = new Set<number>();
      const sets: LoggedSet[] = [];
      const throws: LoggedThrow[] = [];

      for (const tl of blockLogs) {
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = tl.notes ? JSON.parse(tl.notes) : null;
        } catch (err) {
          // not JSON
          logger.debug("not JSON", {
            context: "src/app/(dashboard)/athlete/throws/live/[assignmentId]/_live-workout.tsx",
            metadata: { reason: err instanceof Error ? err.message : "unknown" },
          });
        }

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
          throws.push({
            throwNumber: tl.throwNumber,
            distance: tl.distance ?? 0,
            id: tl.id,
          });
        }
      }

      map.set(block.id, { throws, sets, warmupChecked, completed: false });
    }
    return map;
  });

  // Auto-expand first incomplete block on mount
  useEffect(() => {
    if (expandedBlockId === null && !showCompletion) {
      const firstIncomplete = data.blocks.find((b) => {
        const state = blockStates.get(b.id);
        if (!state) return true;
        return !isBlockComplete(b, state);
      });
      if (firstIncomplete) {
        setExpandedBlockId(firstIncomplete.id);
      }
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unsaved changes warning + back button protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      if (
        confirm(
          "Leave workout? Your logged throws are saved, but the session won't be marked complete."
        )
      ) {
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

  // ── Handlers ──────────────────────────────────────────────────────

  const advanceToNextBlock = useCallback(
    (currentBlockId: string) => {
      const idx = data.blocks.findIndex((b) => b.id === currentBlockId);
      if (idx < data.blocks.length - 1) {
        setExpandedBlockId(data.blocks[idx + 1].id);
      } else {
        // Last block completed — show completion
        setExpandedBlockId(null);
        setShowCompletion(true);
      }
    },
    [data.blocks]
  );

  const handleThrowLogged = useCallback(
    (blockId: string, t: LoggedThrow) => {
      setBlockStates((prev) => {
        const next = new Map(prev);
        const state = { ...next.get(blockId)! };
        state.throws = [...state.throws, t];

        // Auto-advance if block complete
        const block = data.blocks.find((b) => b.id === blockId);
        if (block) {
          const cfg = parseConfig(block.config);
          const target = getThrowCount(cfg);
          if (state.throws.length >= target) {
            // Delay advance slightly so the athlete sees the completion
            setTimeout(() => advanceToNextBlock(blockId), 800);
          }
        }

        next.set(blockId, state);
        return next;
      });
    },
    [data.blocks, advanceToNextBlock]
  );

  const handleSetLogged = useCallback(
    (blockId: string, s: LoggedSet) => {
      setBlockStates((prev) => {
        const next = new Map(prev);
        const state = { ...next.get(blockId)! };
        state.sets = [...state.sets, s];

        const block = data.blocks.find((b) => b.id === blockId);
        if (block) {
          const cfg = parseConfig(block.config);
          const exercises = (cfg.exercises as Array<Record<string, unknown>>) ?? [];
          const targetSets = (exercises[0]?.sets as number) || (cfg.sets as number) || 0;
          if (targetSets > 0 && state.sets.length >= targetSets) {
            setTimeout(() => advanceToNextBlock(blockId), 800);
          }
        }

        next.set(blockId, state);
        return next;
      });
    },
    [data.blocks, advanceToNextBlock]
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
          })
            .then(async (r) => {
              if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                throw new Error(err.error || `Failed to save warmup drill (${r.status})`);
              }
            })
            .catch((err) => {
              // Surface failure so the athlete knows the checkmark isn't
              // persisted — coach won't see this warmup drill in history.
              logger.error("warmup drill persist failed", {
                context: "athlete/throws/live/[id]/live-workout",
                error: err,
              });
              toast(
                err instanceof Error
                  ? err.message
                  : "Couldn't save warmup drill — check will retry on next load",
                "error"
              );
            });
        }

        return next;
      });
    },
    [data.assignmentId, toast]
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

  // ── Derived: block group labels ──────────────────────────────────

  const blockGroups = useMemo(() => {
    const groups: { label: string; color: string; startIdx: number }[] = [];
    let lastType = "";
    let throwingBlockNum = 0;
    let strengthBlockNum = 0;

    for (let i = 0; i < data.blocks.length; i++) {
      const bt = data.blocks[i].blockType?.toUpperCase();
      if (bt !== lastType) {
        if (bt === "THROWING") {
          throwingBlockNum++;
          const cfg = parseConfig(data.blocks[i].config);
          const impl = getImplement(cfg) || `${getImplementKg(cfg)}kg`;
          groups.push({
            label: `Throwing Block ${throwingBlockNum} · ${impl}`,
            color: getBlockAccent(data.blocks[i]),
            startIdx: i,
          });
        } else if (bt === "STRENGTH") {
          strengthBlockNum++;
          groups.push({
            label: `Strength Block${strengthBlockNum > 1 ? ` ${strengthBlockNum}` : ""}`,
            color: "#4488FF",
            startIdx: i,
          });
        } else if (bt === "WARMUP") {
          groups.push({ label: "Warm-Up", color: "#FF8800", startIdx: i });
        } else if (bt === "COOLDOWN") {
          groups.push({ label: "Cool-Down", color: "#00BBFF", startIdx: i });
        }
        lastType = bt || "";
      }
    }
    return groups;
  }, [data.blocks]);

  // ── Derived: progress stats ──────────────────────────────────────

  const completedBlocks = data.blocks.filter((b) => {
    const state = blockStates.get(b.id);
    return state && isBlockComplete(b, state);
  }).length;

  // ── Render ───────────────────────────────────────────────────────

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
          <button
            onClick={handleEndSession}
            className="text-xs text-white/50 flex items-center gap-1 min-h-[44px]"
          >
            <ChevronLeft size={14} strokeWidth={1.75} aria-hidden="true" /> END
          </button>

          <div className="text-center flex-1">
            <h1
              className="text-sm font-heading font-bold tracking-wider"
              style={{ color: "#FFC800" }}
            >
              {data.sessionName}
            </h1>
            <p className="text-[10px] text-white/30 tabular-nums">
              {completedBlocks}/{data.blocks.length} blocks · {formatElapsed(elapsed)}
            </p>
          </div>

          <div className="flex items-center gap-2 min-w-[60px] justify-end">
            <span className="text-[9px] tracking-widest font-semibold text-emerald-500/60">
              ● LIVE
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 bg-white/[0.03] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${data.blocks.length > 0 ? (completedBlocks / data.blocks.length) * 100 : 0}%`,
              backgroundColor: "#FFC800",
              boxShadow: "0 0 8px #FFC80044",
            }}
          />
        </div>
      </div>

      {/* ── Timeline Content ── */}
      <div className="flex-1 overflow-y-auto pb-20 px-4">
        {data.blocks.map((block, idx) => {
          const bt = block.blockType?.toUpperCase();
          const state = blockStates.get(block.id) ?? {
            throws: [],
            sets: [],
            warmupChecked: new Set<number>(),
            completed: false,
          };
          const accent = getBlockAccent(block);
          const exerciseName = getExerciseName(block);
          const cfg = parseConfig(block.config);

          const complete = isBlockComplete(block, state);
          const isExpanded = expandedBlockId === block.id;

          // Determine if this block is tappable (only if previous is complete or this is first)
          const prevBlock = idx > 0 ? data.blocks[idx - 1] : null;
          const prevState = prevBlock ? blockStates.get(prevBlock.id) : null;
          const canExpand =
            idx === 0 ||
            (prevBlock && prevState && isBlockComplete(prevBlock, prevState)) ||
            complete;

          const nodeState: NodeState = isExpanded
            ? "active"
            : complete
              ? "completed"
              : canExpand
                ? "ready"
                : "locked";

          // Build subtitle from prescription
          let subtitle = "";
          if (bt === "THROWING") {
            const impl = getImplement(cfg) || `${getImplementKg(cfg)}kg`;
            const count = getThrowCount(cfg);
            subtitle = `${count} throws · ${impl}`;
          } else if (bt === "STRENGTH") {
            const exercises = (cfg.exercises as Array<Record<string, unknown>>) ?? [];
            if (exercises.length > 0) {
              const ex = exercises[0];
              subtitle = `${ex.sets || "—"} × ${ex.reps || "—"}${ex.percentage ? ` @ ${ex.percentage}%` : ""}`;
            }
          } else if (bt === "WARMUP" || bt === "COOLDOWN") {
            const drills = (cfg.drills as unknown[]) ?? [];
            subtitle = `${drills.length} drills`;
          }

          // Build summary line for completed blocks
          let summaryLine = "";
          if (complete) {
            if (bt === "THROWING") {
              const marked = state.throws.filter((t) => t.distance !== null && t.distance > 0);
              const best = marked.length > 0 ? Math.max(...marked.map((t) => t.distance!)) : 0;
              summaryLine = `${state.throws.length} throws${best > 0 ? ` · Best: ${best.toFixed(2)}m` : ""}`;
            } else if (bt === "STRENGTH") {
              const best = state.sets.length > 0 ? Math.max(...state.sets.map((s) => s.weight)) : 0;
              summaryLine = `${state.sets.length} sets${best > 0 ? ` · Top: ${best}kg` : ""}`;
            } else {
              summaryLine = `${state.warmupChecked.size} drills done`;
            }
          }

          // Check if we should show a block group label before this block
          const groupLabel = blockGroups.find((g) => g.startIdx === idx);

          return (
            <div key={block.id}>
              {groupLabel && <BlockGroupLabel label={groupLabel.label} color={groupLabel.color} />}
              <TimelineNode
                nodeState={nodeState}
                accent={accent}
                title={exerciseName}
                subtitle={subtitle}
                summaryLine={summaryLine}
                isLast={idx === data.blocks.length - 1 && !showCompletion}
                onTap={() => {
                  if (complete || canExpand) {
                    setExpandedBlockId(isExpanded ? null : block.id);
                    setShowCompletion(false);
                  }
                }}
              >
                {/* ── Expanded block content ── */}
                {bt === "THROWING" && (
                  <>
                    <TimelineProgressDots
                      total={getThrowCount(cfg)}
                      completed={state.throws.length}
                      accentColor={accent}
                    />
                    <ThrowingBlockView
                      block={block}
                      state={state}
                      assignmentId={data.assignmentId}
                      event={data.event}
                      onThrowLogged={(t) => handleThrowLogged(block.id, t)}
                    />
                  </>
                )}
                {bt === "STRENGTH" && (
                  <StrengthBlockView
                    block={block}
                    state={state}
                    onSetLogged={(s) => handleSetLogged(block.id, s)}
                    assignmentId={data.assignmentId}
                  />
                )}
                {(bt === "WARMUP" || bt === "COOLDOWN") && (
                  <WarmupCooldownView
                    block={block}
                    state={state}
                    onToggleDrill={(i) => handleToggleDrill(block.id, i)}
                    onAdvance={() => advanceToNextBlock(block.id)}
                    isLastBlock={idx === data.blocks.length - 1}
                  />
                )}
              </TimelineNode>
            </div>
          );
        })}

        {/* ── Completion at bottom of timeline ── */}
        {showCompletion && (
          <div className="relative flex gap-4">
            <div className="flex flex-col items-center shrink-0" style={{ width: 24 }}>
              <div
                className="timeline-dot-pulse"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  marginTop: 14,
                  backgroundColor: "#00FF88",
                  boxShadow: "0 0 10px #00FF8844",
                }}
              />
            </div>
            <div className="flex-1 min-w-0 mb-3 timeline-completion-enter">
              <CompletionScreen
                assignmentId={data.assignmentId}
                blockStates={blockStates}
                elapsed={elapsed}
                sessionName={data.sessionName}
              />
            </div>
          </div>
        )}

        {/* ── Finish Session button (when all blocks done but completion not shown) ── */}
        {!showCompletion && completedBlocks === data.blocks.length && (
          <div className="mt-4 px-2">
            <button
              onClick={() => {
                setExpandedBlockId(null);
                setShowCompletion(true);
              }}
              className="w-full py-4 text-sm font-bold tracking-widest rounded-xl transition-transform active:scale-[0.97]"
              style={{ background: "#00FF88", color: "#000" }}
            >
              FINISH SESSION
            </button>
          </div>
        )}
      </div>

      {/* ── Timeline CSS ── */}
      <style>{`
        @keyframes timeline-dot-ring {
          0%, 100% { box-shadow: 0 0 0 0 currentColor; }
          50% { box-shadow: 0 0 0 4px transparent; }
        }
        .timeline-dot-pulse {
          animation: timeline-dot-ring 1.8s ease-in-out infinite;
        }

        @keyframes timeline-shine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .timeline-node-expanded {
          background-size: 200% 100%;
          animation: timeline-shine 6s ease-in-out infinite;
        }

        @keyframes timeline-completion-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .timeline-completion-enter {
          animation: timeline-completion-in 0.4s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .timeline-dot-pulse,
          .timeline-node-expanded,
          .timeline-completion-enter {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  HELPERS                                                                */
/* ═══════════════════════════════════════════════════════════════════════ */

function isBlockComplete(block: { blockType: string; config: string }, state: BlockState): boolean {
  const bt = block.blockType?.toUpperCase();
  const cfg = parseConfig(block.config);

  if (bt === "THROWING" || bt === "PLYOMETRIC") {
    return state.throws.length >= getThrowCount(cfg);
  }
  if (bt === "STRENGTH") {
    const exercises = (cfg.exercises as Array<Record<string, unknown>>) ?? [];
    const targetSets = (exercises[0]?.sets as number) || (cfg.sets as number) || 0;
    return targetSets > 0 && state.sets.length >= targetSets;
  }
  if (bt === "WARMUP" || bt === "COOLDOWN") {
    const drills = (cfg.drills as unknown[]) ?? [];
    return drills.length > 0 && state.warmupChecked.size >= drills.length;
  }
  return false;
}
