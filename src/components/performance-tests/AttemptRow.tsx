"use client";

import { useState, useRef, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { Trash2, Flag, Pencil, Check, X } from "lucide-react";
import {
  CM_TO_INCHES,
  formatTestValueShort,
  type PerformanceTestAttemptDTO,
  type PerformanceTestTypeDTO,
} from "@/lib/performance-tests-display";

const CM_PER_INCH = 2.54;

export interface AttemptRowProps {
  attempt: PerformanceTestAttemptDTO;
  testType: PerformanceTestTypeDTO;
  busy?: boolean;
  /** When the parent's input is "in", edit input + commit also use inches. */
  inputUnit?: "cm" | "in";
  onEdit: (attemptId: string, value: number) => Promise<void> | void;
  onToggleFoul: (attemptId: string, nextIsValid: boolean) => Promise<void> | void;
  onDelete: (attemptId: string) => Promise<void> | void;
}

const SWIPE_REVEAL_PX = 144; // shows two action buttons

/**
 * One attempt in the capture list.
 *
 * Mobile: swipe-left to reveal "Mark foul" + "Delete". Tap-row toggles inline
 * value edit. Desktop: action buttons render inline in the row.
 *
 * Foul-marked attempts render at half opacity with a strikethrough on the
 * value. Edit attribution chip ("edited by you") fires when lastEditedAt is
 * present.
 */
export function AttemptRow({
  attempt,
  testType,
  busy = false,
  inputUnit = "cm",
  onEdit,
  onToggleFoul,
  onDelete,
}: AttemptRowProps) {
  // Edit input shows the value in the user's preferred unit (only meaningful
  // for cm-unit tests; sec/inputUnit="cm" tests behave unchanged).
  const editsInInches = testType.unit === "cm" && inputUnit === "in";

  const toEditDisplay = (cm: number): string =>
    editsInInches ? (cm * CM_TO_INCHES).toFixed(1) : cm.toString();

  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(toEditDisplay(attempt.value));
  const [translateX, setTranslateX] = useState(0);
  const startXRef = useRef(0);
  const dragRef = useRef(false);
  const startedFromRef = useRef(0);

  const isFoul = !attempt.isValid;

  function commitEdit() {
    const typed = parseFloat(draftValue);
    if (!Number.isFinite(typed) || typed < 0) {
      setEditing(false);
      return;
    }
    const next = editsInInches ? +(typed * CM_PER_INCH).toFixed(1) : typed;
    if (next !== attempt.value) {
      void onEdit(attempt.id, next);
    }
    setEditing(false);
  }

  function cancelEdit() {
    setDraftValue(toEditDisplay(attempt.value));
    setEditing(false);
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    dragRef.current = true;
    startXRef.current = e.clientX;
    startedFromRef.current = translateX;
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || e.pointerType !== "touch") return;
    const dx = e.clientX - startXRef.current;
    const next = Math.max(-SWIPE_REVEAL_PX, Math.min(0, startedFromRef.current + dx));
    setTranslateX(next);
  }

  function handlePointerUp() {
    if (!dragRef.current) return;
    dragRef.current = false;
    setTranslateX(translateX < -SWIPE_REVEAL_PX / 2 ? -SWIPE_REVEAL_PX : 0);
  }

  return (
    <div className="relative">
      {/* Mobile swipe-action backplane */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex items-stretch gap-px sm:hidden"
        style={{ width: SWIPE_REVEAL_PX }}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void onToggleFoul(attempt.id, !attempt.isValid);
            setTranslateX(0);
          }}
          className="w-1/2 flex flex-col items-center justify-center gap-1 bg-warning-500/15 text-warning-700 dark:text-warning-400 text-[11px] font-semibold disabled:opacity-50"
        >
          <Flag size={16} strokeWidth={2} aria-hidden="true" />
          {isFoul ? "Restore" : "Foul"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void onDelete(attempt.id);
            setTranslateX(0);
          }}
          className="w-1/2 flex flex-col items-center justify-center gap-1 bg-danger-500/15 text-danger-600 dark:text-danger-400 text-[11px] font-semibold disabled:opacity-50"
        >
          <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
          Delete
        </button>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragRef.current ? "none" : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)",
          touchAction: "pan-y",
        }}
        className={cn(
          "relative flex items-center justify-between gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--surface-overlay)] px-4 py-3",
          isFoul && "opacity-60"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted tabular-nums w-7">
            #{attempt.attemptNumber}
          </span>
          {editing ? (
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              step={testType.unit === "sec" ? "0.01" : "0.1"}
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              onBlur={commitEdit}
              className="input w-28 font-mono tabular-nums"
              aria-label={`Edit attempt ${attempt.attemptNumber}`}
            />
          ) : (
            <span
              className={cn(
                "font-mono tabular-nums text-base font-semibold text-[var(--foreground)]",
                isFoul && "line-through"
              )}
            >
              {formatTestValueShort(attempt.value, testType.unit)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button
                type="button"
                onClick={commitEdit}
                aria-label="Save"
                className="p-1.5 rounded-md text-success-500 hover:bg-success-500/10 transition-colors"
              >
                <Check size={16} strokeWidth={2.25} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                aria-label="Cancel"
                className="p-1.5 rounded-md text-muted hover:text-[var(--foreground)] transition-colors"
              >
                <X size={16} strokeWidth={2.25} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraftValue(toEditDisplay(attempt.value));
                  setEditing(true);
                }}
                disabled={busy}
                aria-label={`Edit attempt ${attempt.attemptNumber}`}
                className="p-1.5 rounded-md text-muted hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
              >
                <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onToggleFoul(attempt.id, !attempt.isValid)}
                disabled={busy}
                aria-label={isFoul ? "Restore attempt" : "Mark foul"}
                className="hidden sm:inline-flex p-1.5 rounded-md text-muted hover:text-warning-600 dark:hover:text-warning-400 transition-colors disabled:opacity-50"
              >
                <Flag size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(attempt.id)}
                disabled={busy}
                aria-label={`Delete attempt ${attempt.attemptNumber}`}
                className="hidden sm:inline-flex p-1.5 rounded-md text-muted hover:text-danger-500 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
