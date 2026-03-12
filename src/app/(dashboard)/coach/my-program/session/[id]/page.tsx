"use client";

import { useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessionReducer, type ThrowEntry, type LiftEntry } from "@/components/session/use-session-reducer";
import { SessionProgressHeader } from "@/components/session/session-progress-header";
import { WarmupChecklist } from "@/components/session/warmup-checklist";
import { ThrowBlockCard } from "@/components/session/throw-block-card";
import { StrengthBlockCard } from "@/components/session/strength-block-card";
import { CompletionBottomSheet } from "@/components/session/completion-bottom-sheet";
import { CompletedSessionSummary } from "@/components/session/completed-session-summary";

// ── Main Component ────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { state, dispatch, computed } = useSessionReducer();

  // ── Load session ──────────────────────────────────────────────────

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const progRes = await fetch("/api/throws/program");
      if (!progRes.ok) {
        dispatch({ type: "SET_ERROR", payload: "Could not load program" });
        return;
      }
      const { data: progData } = await progRes.json();
      if (!progData) {
        dispatch({ type: "SET_ERROR", payload: "No active program" });
        return;
      }

      const res = await fetch(
        `/api/throws/program/${progData.id}/sessions/${sessionId}`,
      );
      if (!res.ok) {
        dispatch({ type: "SET_ERROR", payload: "Session not found" });
        return;
      }
      const { data } = await res.json();
      dispatch({ type: "SET_SESSION", payload: data });
    } catch {
      dispatch({ type: "SET_ERROR", payload: "Failed to load session" });
    }
  }, [sessionId, dispatch]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // ── API Helpers ───────────────────────────────────────────────────

  const logThrowToApi = useCallback(
    async (entry: ThrowEntry) => {
      if (!state.session) return;
      try {
        const res = await fetch(
          `/api/throws/program/${state.session.programId}/sessions/${state.session.id}/throws`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              throwNumber: entry.throwNumber,
              implement: entry.implement,
              distance: entry.distance,
              drillType: entry.drillType,
            }),
          },
        );
        if (res.ok) {
          dispatch({
            type: "MARK_THROW_SYNCED",
            payload: {
              blockIndex: state.currentBlockIndex,
              throwNumber: entry.throwNumber,
            },
          });
        }
      } catch {
        // Optimistic — already in local state
      }
    },
    [state.session, state.currentBlockIndex, dispatch],
  );

  const logLiftToApi = useCallback(
    async (blockIndex: number, entry: LiftEntry) => {
      if (!state.session) return;
      try {
        const res = await fetch(
          `/api/throws/program/${state.session.programId}/sessions/${state.session.id}/lifts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              exerciseName: entry.exerciseName,
              exerciseId: entry.exerciseId,
              sets: entry.setNumber,
              reps: entry.reps,
              weight: entry.weight,
              rpe: entry.rpe ?? null,
            }),
          },
        );
        if (res.ok) {
          dispatch({
            type: "MARK_LIFT_SYNCED",
            payload: { blockIndex, setNumber: entry.setNumber },
          });
        }
      } catch {
        // Optimistic
      }
    },
    [state.session, dispatch],
  );

  // ── Throw handler (optimistic + API) ──────────────────────────────

  function handleLogThrow(entry: ThrowEntry) {
    dispatch({
      type: "LOG_THROW",
      payload: { blockIndex: state.currentBlockIndex, entry },
    });

    // Check if this completes the current set — start rest
    const block = state.session?.throwsPrescription[state.currentBlockIndex];
    if (block) {
      const currentSetStart = state.currentSetIndex * block.repsPerSet;
      const throwsInSet = (state.throwsByBlock[state.currentBlockIndex]?.length ?? 0) + 1 - currentSetStart;
      if (throwsInSet >= block.repsPerSet && state.currentSetIndex < block.sets - 1) {
        dispatch({ type: "START_REST", payload: block.restSeconds });
      }
    }

    logThrowToApi(entry);
  }

  function handleLogLift(blockIndex: number, entry: LiftEntry) {
    dispatch({ type: "LOG_LIFT", payload: { blockIndex, entry } });
    logLiftToApi(blockIndex, entry);
  }

  function handleAdvanceBlock() {
    // Trigger intra-eval when completing block 1 (index 0)
    if (state.currentBlockIndex === 0 && state.session) {
      const blockBestMark = computed.currentBlockBest;
      if (blockBestMark == null || blockBestMark <= 0) {
        // No mark recorded — skip evaluation
        dispatch({
          type: "INTRA_EVAL_RESULT",
          payload: { suggestion: null, applied: false },
        });
      } else {
        dispatch({ type: "INTRA_EVAL_START" });
        fetch(
          `/api/throws/session/${state.session.id}/intra-evaluate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blockNumber: 1,
              blockBestMark,
            }),
          },
        )
          .then((res) => {
            if (!res.ok) throw new Error("intra-eval failed");
            return res.json();
          })
          .then((json) => {
            const data = json?.data;
            dispatch({
              type: "INTRA_EVAL_RESULT",
              payload: {
                suggestion: data?.suggestion ?? null,
                applied: data?.applied ?? false,
              },
            });
          })
          .catch(() => {
            dispatch({
              type: "INTRA_EVAL_RESULT",
              payload: { suggestion: null, applied: false },
            });
          });
      }
    }

    dispatch({ type: "ADVANCE_BLOCK" });
  }

  function handleStrengthDone() {
    dispatch({ type: "SET_PHASE", payload: "complete" });
  }

  // ── Complete session ──────────────────────────────────────────────

  async function handleComplete() {
    if (!state.session) return;
    dispatch({ type: "SET_SUBMITTING", payload: true });

    try {
      // Submit best marks
      const marks = Object.entries(state.bestMarks).map(([impl, dist]) => ({
        implement: impl,
        distance: dist,
        drillType: null,
      }));

      if (marks.length > 0) {
        await fetch(
          `/api/throws/program/${state.session.programId}/sessions/${state.session.id}/best-marks`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ marks }),
          },
        ).catch(() => {});
      }

      // Complete session
      const res = await fetch(
        `/api/throws/program/${state.session.programId}/sessions/${state.session.id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actualThrows: computed.totalThrowsLogged || undefined,
            bestMark: computed.overallBest || undefined,
            rpe: state.rpe,
            selfFeeling: state.selfFeeling,
            sessionNotes: state.sessionNotes || undefined,
            wasModified: state.wasModified || undefined,
            modificationNotes: state.modificationNotes || undefined,
          }),
        },
      );

      if (res.ok) {
        dispatch({ type: "SESSION_COMPLETED" });
        await loadSession();
      }
    } catch {
      // silently fail
    } finally {
      dispatch({ type: "SET_SUBMITTING", payload: false });
    }
  }

  // ── Render states ─────────────────────────────────────────────────

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[var(--color-text-3)]">Loading session...</div>
      </div>
    );
  }

  if (state.error || !state.session) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-red-500">{state.error || "Session not found"}</p>
        <button
          onClick={() => router.push("/coach/my-program")}
          className="btn-secondary mt-4 px-4 py-2"
        >
          Back to Program
        </button>
      </div>
    );
  }

  // Completed view
  if (state.currentPhase === "summary") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        <CompletedSessionSummary session={state.session} />
      </div>
    );
  }

  const session = state.session;
  const hasThrows = session.throwsPrescription.length > 0;
  const hasStrength = session.strengthPrescription.length > 0;

  return (
    <div className="max-w-2xl mx-auto pb-safe">
      {/* Sticky progress header */}
      <SessionProgressHeader
        state={state}
        dispatch={dispatch}
        totalThrowsLogged={computed.totalThrowsLogged}
        totalThrowBlocks={computed.totalThrowBlocks}
        overallProgress={computed.overallProgress}
      />

      {/* Session info bar */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]/60">
        <h1 className="text-base font-heading font-semibold text-[var(--color-text)]">
          {session.focusLabel}
        </h1>
        <p className="text-xs text-[var(--color-text-2)]">
          Week {session.weekNumber} &middot; Day {session.dayType} &middot; ~{session.estimatedDuration}min
        </p>
      </div>

      {/* Phase content */}
      <div className="px-4 py-4 space-y-4">
        {/* Warmup phase */}
        {state.currentPhase === "warmup" && (
          <WarmupChecklist
            warmups={session.warmupPrescription}
            checked={state.warmupChecked}
            dispatch={dispatch}
            hasThrows={hasThrows}
            hasStrength={hasStrength}
          />
        )}

        {/* Throws phase */}
        {state.currentPhase === "throws" && computed.currentBlock && (
          <ThrowBlockCard
            block={computed.currentBlock}
            blockIndex={state.currentBlockIndex}
            currentSetIndex={state.currentSetIndex}
            blockThrows={computed.currentBlockThrows}
            bestMark={computed.currentBlockBest}
            isLastBlock={state.currentBlockIndex >= computed.totalThrowBlocks - 1}
            restActive={state.restActive}
            restSeconds={state.restSeconds}
            dispatch={dispatch}
            onLogThrow={handleLogThrow}
            onAdvanceBlock={handleAdvanceBlock}
          />
        )}

        {/* Strength phase */}
        {state.currentPhase === "strength" && (
          <StrengthBlockCard
            blocks={session.strengthPrescription}
            liftsByBlock={state.liftsByBlock}
            dispatch={dispatch}
            onLogLift={handleLogLift}
            onDone={handleStrengthDone}
          />
        )}

        {/* Complete phase — show button to open completion sheet */}
        {state.currentPhase === "complete" && (
          <div className="space-y-4">
            {/* Quick summary */}
            <div className="card">
              <h2 className="text-section font-heading text-[var(--color-text)] mb-2">
                Session Review
              </h2>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-[var(--color-text-2)]">Throws logged</span>
                <span className="font-semibold text-[var(--color-text)] tabular-nums">
                  {computed.totalThrowsLogged}
                </span>
              </div>
              {computed.overallBest && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-2)]">Best mark</span>
                  <span className="font-semibold text-[var(--color-gold-dark)] dark:text-[var(--color-gold-light)] tabular-nums">
                    {computed.overallBest}m
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => dispatch({ type: "SHOW_COMPLETION_SHEET", payload: true })}
              className="btn-primary w-full py-3.5 text-sm font-semibold"
            >
              Complete Session
            </button>
          </div>
        )}
      </div>

      {/* Completion bottom sheet */}
      {state.showCompletionSheet && (
        <CompletionBottomSheet
          state={state}
          dispatch={dispatch}
          totalThrowsLogged={computed.totalThrowsLogged}
          bestMarks={state.bestMarks}
          onSubmit={handleComplete}
          onCancel={() => dispatch({ type: "SHOW_COMPLETION_SHEET", payload: false })}
        />
      )}
    </div>
  );
}
