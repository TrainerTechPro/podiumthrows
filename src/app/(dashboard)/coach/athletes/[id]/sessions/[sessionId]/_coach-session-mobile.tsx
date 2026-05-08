"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  MoreVertical,
  Check,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Mic,
  Save,
  X,
} from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import { Sheet, useSheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { ExerciseInspectorSheet } from "@/components/coach/ExerciseInspectorSheet";
import type {
  CoachSessionDetailDTO,
  CoachLaneDTO,
  CoachExerciseDTO,
  CoachStat,
} from "@/lib/coach/session-detail";
import { getExerciseViolations } from "@/lib/bondarchuk/movement-restrictions";
import { MovementRestrictionBadge } from "@/components/coach/MovementRestrictionBadge";
import type { MovementRestrictionsData } from "@/app/(dashboard)/athlete/profile/_types";

interface Props {
  initial: CoachSessionDetailDTO;
}

/**
 * Coach mobile session detail — sideline glance, not workspace.
 *
 * Read-only viewer. No drag/drop, no inspector, no ⌘K, no entry UI on the
 * active block (athletes log; coaches watch). The FAB is the only primary
 * action — it captures an observation as a session note. Voice memo (Prompt 4)
 * will replace the text composer behind the FAB without changing this layout.
 */
export function CoachSessionMobile({ initial }: Props) {
  const [dto, setDto] = useState<CoachSessionDetailDTO>(initial);
  const [inspectorExerciseId, setInspectorExerciseId] = useState<string | null>(null);
  const noteSheet = useSheet(false);
  const { success, error: toastError } = useToast();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/coach/sessions/${dto.sessionId}?athleteId=${dto.athleteProfileId}`,
        { cache: "no-store" }
      );
      const payload = (await res.json()) as
        | { success: true; data: CoachSessionDetailDTO }
        | { success: false; error: string };
      if (!res.ok || !payload.success) return;
      setDto(payload.data);
    } catch (err) {
      logger.warn("Coach session refresh failed", {
        context: "coach-session-detail-mobile",
        error: err,
      });
    }
  }, [dto.sessionId, dto.athleteProfileId]);

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[var(--background)] sm:-mx-6">
      <PageHeader athleteName={dto.athlete.name} dateLabel={dto.scheduledDateLabel} />

      <div className="flex flex-1 flex-col">
        <IdentityRow athlete={dto.athlete} />
        <StatusStrip dto={dto} />
        {dto.periodization ? <PerioBand p={dto.periodization} /> : null}
        <SectionHeader dto={dto} />

        <div className="flex flex-col gap-2 px-3 pb-32 pt-1">
          {dto.blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              onOpenInspector={(id) => setInspectorExerciseId(id)}
              restrictions={dto.athlete.movementRestrictions}
            />
          ))}
        </div>
      </div>

      <FAB onClick={() => noteSheet.onOpen()} />

      <ExerciseInspectorSheet
        open={inspectorExerciseId != null}
        onClose={() => setInspectorExerciseId(null)}
        athleteId={dto.athleteProfileId}
        exerciseId={inspectorExerciseId ?? ""}
        contextSessionId={dto.sessionId}
      />

      <Sheet
        open={noteSheet.open}
        onClose={noteSheet.onClose}
        side="bottom"
        size="md"
        title="Add observation"
        ariaLabel="Add observation"
        className="!bg-[var(--surface-overlay)]"
      >
        <NoteComposer
          sessionId={dto.sessionId}
          onSaved={async (noteText) => {
            success("Note saved");
            setDto((d) => ({
              ...d,
              lastNote: { quote: noteText, authorLabel: "COACH · THIS SESSION" },
            }));
            noteSheet.onClose();
            await refresh();
          }}
          onError={(message) => toastError("Couldn't save note", message)}
        />
      </Sheet>
    </div>
  );
}

// ── Page header (in-page, not the shell top bar) ─────────────────────────────

function PageHeader({ athleteName, dateLabel }: { athleteName: string; dateLabel: string }) {
  return (
    <div
      className="sticky top-14 z-10 flex items-center justify-between border-b border-[var(--card-border)] bg-[var(--card-bg)] px-1.5"
      style={{ height: "52px" }}
    >
      <Link
        href="/coach/athletes"
        className="flex items-center gap-0.5 rounded-lg px-2 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        <span>Roster</span>
      </Link>
      <div className="min-w-0 flex-1 px-2 text-center">
        <div className="truncate font-heading text-[15px] font-semibold leading-tight text-[var(--foreground)]">
          {athleteName}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
          {dateLabel}
        </div>
      </div>
      <button
        type="button"
        aria-label="More options"
        className="grid h-9 w-9 place-items-center rounded-lg text-[var(--foreground)] hover:bg-surface-100 dark:hover:bg-surface-800"
      >
        <MoreVertical className="h-[19px] w-[19px]" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Identity row ─────────────────────────────────────────────────────────────

function IdentityRow({ athlete }: { athlete: CoachSessionDetailDTO["athlete"] }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3.5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] border border-[var(--card-border)] bg-gradient-to-br from-surface-300 to-surface-400 font-heading text-[13px] font-bold text-[var(--foreground)] dark:from-surface-700 dark:to-surface-800">
        {athlete.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate font-heading text-[17px] font-semibold leading-tight tracking-[-0.005em] text-[var(--foreground)]"
          title={athlete.name}
        >
          {athlete.name}
        </div>
        <div
          className="mt-0.5 truncate font-mono text-[10.5px] tracking-[0.06em] text-[var(--muted)]"
          title={athlete.meta}
        >
          {athlete.meta}
        </div>
      </div>
    </div>
  );
}

// ── Status chips strip (horizontal scroll) ───────────────────────────────────

function StatusStrip({ dto }: { dto: CoachSessionDetailDTO }) {
  const valid = dto.validator.valid;
  return (
    <div
      className="custom-scrollbar flex items-center gap-2 overflow-x-auto border-b border-[var(--card-border)] bg-surface-50 px-3.5 py-2.5 dark:bg-surface-900/60"
      role="status"
      aria-label="Session status"
    >
      <Chip
        tone={valid ? "ok" : "danger"}
        icon={
          valid ? (
            <Check className="h-[11px] w-[11px]" strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-[11px] w-[11px]" strokeWidth={2} aria-hidden="true" />
          )
        }
      >
        VOL IV · {valid ? "VALID" : "VIOLATION"}
      </Chip>
      {dto.readiness ? <ReadinessChip stat={dto.readiness} /> : null}
      {dto.vsLast ? <DeltaChip stat={dto.vsLast} /> : null}
    </div>
  );
}

function Chip({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "ok" | "danger" | "delta";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-success-500/25 bg-success-500/10 text-success-500"
      : tone === "danger"
        ? "border-danger-500/30 bg-danger-500/10 text-danger-500"
        : tone === "delta"
          ? "border-success-500/25 bg-success-500/10 text-success-500"
          : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)]";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.04em] ${cls}`}
    >
      {icon}
      {children}
    </span>
  );
}

function ReadinessChip({ stat }: { stat: CoachStat }) {
  const valTone =
    stat.tone === "success"
      ? "text-success-500"
      : stat.tone === "warning"
        ? "text-warning-500"
        : stat.tone === "danger"
          ? "text-danger-500"
          : "text-[var(--foreground)]";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.04em]">
      <span className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">RDY</span>
      <span className={`font-semibold tabular-nums ${valTone}`}>{stat.value}</span>
    </span>
  );
}

function DeltaChip({ stat }: { stat: CoachStat }) {
  const positive = stat.tone === "success";
  return (
    <Chip
      tone="delta"
      icon={
        positive ? (
          <TrendingUp className="h-[11px] w-[11px]" strokeWidth={2} aria-hidden="true" />
        ) : (
          <TrendingDown className="h-[11px] w-[11px]" strokeWidth={2} aria-hidden="true" />
        )
      }
    >
      {stat.value.toUpperCase()} VS LAST
    </Chip>
  );
}

// ── Periodization band ───────────────────────────────────────────────────────

function PerioBand({ p }: { p: NonNullable<CoachSessionDetailDTO["periodization"]> }) {
  return (
    <div className="border-b border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">
          Phase · {p.phaseLabel}
        </span>
        <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-[var(--foreground)]">
          WK {p.currentWeek} / {p.totalWeeks}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
        {Array.from({ length: p.totalWeeks }).map((_, i) => {
          const w = i + 1;
          const tone =
            w < p.currentWeek
              ? "bg-primary-500/40"
              : w === p.currentWeek
                ? "bg-primary-500"
                : "bg-surface-300 dark:bg-surface-700";
          return (
            <div
              key={i}
              className={`flex-1 border-r border-[var(--card-bg)] last:border-r-0 ${tone}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ dto }: { dto: CoachSessionDetailDTO }) {
  return (
    <div className="flex items-center justify-between px-4 pb-3 pt-4">
      <h3 className="font-heading text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground)]">
        Today&apos;s Session
      </h3>
      <div className="font-mono text-[10px] tracking-[0.06em] text-[var(--muted)]">
        {dto.totalDurationMinutes} MIN ·{" "}
        <span className="font-medium text-[var(--foreground)]">
          {dto.completedBlocks} OF {dto.totalBlocks} BLOCKS
        </span>
      </div>
    </div>
  );
}

// ── Block card ───────────────────────────────────────────────────────────────

function BlockCard({
  block,
  onOpenInspector,
  restrictions,
}: {
  block: CoachLaneDTO;
  onOpenInspector: (exerciseId: string) => void;
  restrictions: MovementRestrictionsData | null;
}) {
  const isActive = block.status === "active";
  const isComplete = block.status === "complete";

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-[var(--card-bg)] transition-colors ${
        isActive
          ? "border-primary-500/40 shadow-[0_0_0_1px_rgba(184,131,12,0.15)]"
          : "border-[var(--card-border)]"
      }`}
    >
      <BlockHead block={block} isActive={isActive} isComplete={isComplete} />
      {isActive ? (
        <ActiveBlockBody
          block={block}
          onOpenInspector={onOpenInspector}
          restrictions={restrictions}
        />
      ) : (
        <LockedBlockBody block={block} restrictions={restrictions} />
      )}
    </div>
  );
}

function BlockHead({
  block,
  isActive,
  isComplete,
}: {
  block: CoachLaneDTO;
  isActive: boolean;
  isComplete: boolean;
}) {
  const tagClass =
    block.tag === "THROWING"
      ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
      : block.tag === "STRENGTH"
        ? "bg-info-500/10 text-info-500"
        : "bg-surface-100 text-[var(--muted)] dark:bg-surface-800";
  return (
    <div
      className={`flex items-center gap-2.5 border-b border-[var(--card-border)] px-3.5 py-3 ${
        isActive ? "bg-primary-500/[0.04]" : ""
      }`}
    >
      <span
        className={`inline-flex min-w-[20px] items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] ${
          isActive ? "text-primary-500" : "text-[var(--muted)]"
        }`}
      >
        {isActive ? <PulseDot /> : null}
        {block.badge}
      </span>
      <span className="flex-1 font-heading text-[13.5px] font-semibold tracking-[0.005em] text-[var(--foreground)]">
        {block.name}
      </span>
      <span
        className={`rounded-md px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.18em] ${tagClass}`}
      >
        {block.tag}
      </span>
      <span className="font-mono text-[10px] tracking-[0.04em] text-[var(--muted)]">
        {extractMinutes(block.durationLabel)}
      </span>
      {isComplete ? (
        <CheckCircle2
          className="h-3.5 w-3.5 text-success-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

// Active block body — read-only context, NO entry UI.
// Athletes log throws; coaches watch. Different verb, different surface.
function ActiveBlockBody({
  block,
  onOpenInspector,
  restrictions,
}: {
  block: CoachLaneDTO;
  onOpenInspector: (exerciseId: string) => void;
  restrictions: MovementRestrictionsData | null;
}) {
  const isThrowing = block.kind === "throwing";

  if (isThrowing) {
    const totals = computeThrowingTotals(block);
    const lastThrow = pickLastThrowSummary(block);
    return (
      <div className="flex flex-col gap-2.5 px-3.5 py-3">
        <ImplementRow exercises={block.exercises} onOpenInspector={onOpenInspector} />
        <div className="flex items-center justify-between rounded-[9px] bg-surface-50 px-2.5 py-2 font-mono dark:bg-surface-900/60">
          <div>
            <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {lastThrow ? "LAST THROW" : "NO THROWS YET"}
            </div>
            {lastThrow ? (
              <div className="mt-0.5 text-[14px] font-semibold tabular-nums tracking-[-0.01em] text-[var(--foreground)]">
                {lastThrow.distanceLabel}
                {lastThrow.rpeLabel ? (
                  <span className="font-medium text-[var(--muted)]">
                    {" · "}
                    {lastThrow.rpeLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
              PROGRESS
            </div>
            <div className="mt-0.5 text-[13px] tabular-nums">
              <strong className="font-semibold text-[var(--foreground)]">{totals.completed}</strong>
              <span className="text-[var(--muted)]"> / {totals.prescribed} thrown</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Strength active block — compact mini-pills, same as locked strength.
  return <LockedBlockBody block={block} restrictions={restrictions} />;
}

function LockedBlockBody({
  block,
  restrictions,
}: {
  block: CoachLaneDTO;
  restrictions: MovementRestrictionsData | null;
}) {
  const isThrowing = block.kind === "throwing";

  if (block.exercises.length === 0) {
    return (
      <div className="px-3.5 py-2.5 font-mono text-[10px] tracking-[0.06em] text-[var(--muted)]">
        Empty block.
      </div>
    );
  }

  if (isThrowing) {
    return (
      <div className="flex flex-wrap gap-1.5 bg-surface-50 px-3.5 py-2.5 dark:bg-surface-900/60">
        {block.exercises.map((ex) => (
          <ExerciseMiniPill key={ex.id} exercise={ex} kind="throwing" restrictions={null} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 bg-surface-50 px-3.5 py-2.5 dark:bg-surface-900/60">
      {block.exercises.map((ex) => (
        <ExerciseMiniPill key={ex.id} exercise={ex} kind="strength" restrictions={restrictions} />
      ))}
    </div>
  );
}

function ExerciseMiniPill({
  exercise,
  kind,
  restrictions,
}: {
  exercise: CoachExerciseDTO;
  kind: "throwing" | "strength";
  restrictions: MovementRestrictionsData | null;
}) {
  if (kind === "throwing" && exercise.implementKg != null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 font-mono text-[11px] tracking-[0.02em] text-[var(--muted)]">
        {exercise.isHeaviestInBlock ? (
          <span className="h-1 w-1 rounded-full bg-primary-500" aria-hidden="true" />
        ) : null}
        <strong className="font-semibold text-[var(--foreground)]">
          {formatKg(exercise.implementKg)}
        </strong>
        {exercise.sets ? <span>×{exercise.sets}</span> : null}
        {exercise.notes ? <span className="text-[var(--muted)]">· {exercise.notes}</span> : null}
      </span>
    );
  }

  const violations = getExerciseViolations(exercise.name, restrictions);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1 font-mono text-[11px] tracking-[0.02em] text-[var(--muted)]">
      <strong className="font-semibold text-[var(--foreground)]">{exercise.name}</strong>
      <MovementRestrictionBadge violations={violations} />
      {exercise.sets && exercise.reps ? (
        <span>
          · {exercise.sets}×{exercise.reps}
        </span>
      ) : null}
      {exercise.setsBreakdown ? <span>· {exercise.setsBreakdown}</span> : null}
    </span>
  );
}

function ImplementRow({
  exercises,
  onOpenInspector,
}: {
  exercises: CoachExerciseDTO[];
  onOpenInspector: (exerciseId: string) => void;
}) {
  const throwing = exercises.filter((e) => e.implementKg != null);
  if (throwing.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {throwing.map((ex, i) => (
        <span key={ex.id} className="inline-flex items-center gap-2">
          <ImplementPill exercise={ex} onClick={() => onOpenInspector(ex.id)} />
          {i < throwing.length - 1 ? (
            <span aria-hidden="true" className="font-mono text-[12px] text-[var(--muted)]/70">
              →
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function ImplementPill({ exercise, onClick }: { exercise: CoachExerciseDTO; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Inspect ${exercise.name} ${formatKg(exercise.implementKg ?? 0)}`}
      className="inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--card-border)] bg-surface-50 px-2.5 py-1.5 font-mono text-[12.5px] font-semibold tabular-nums text-[var(--foreground)] transition-colors hover:bg-surface-100 active:scale-[0.98] dark:bg-surface-900/60 dark:hover:bg-surface-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
    >
      {exercise.isHeaviestInBlock ? (
        <span
          className="inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-primary-500 shadow-[0_0_6px_color-mix(in_srgb,var(--color-brand)_45%,transparent)]"
          aria-hidden="true"
        />
      ) : null}
      <span>{formatKg(exercise.implementKg ?? 0)}</span>
      {exercise.sets != null ? (
        <span className="text-[11px] font-medium text-[var(--muted)]">×{exercise.sets}</span>
      ) : null}
    </button>
  );
}

function PulseDot() {
  return (
    <span
      className="relative inline-block h-1.5 w-1.5 rounded-full bg-primary-500 motion-safe:animate-pulse"
      style={{ boxShadow: "0 0 6px rgba(255,200,0,0.45)" }}
      aria-hidden="true"
    />
  );
}

// ── FAB ──────────────────────────────────────────────────────────────────────

function FAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Voice note"
      className="fixed bottom-5 right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--foreground)] text-[var(--background)] shadow-[0_8px_24px_-6px_rgba(15,15,20,0.4),0_4px_12px_-2px_rgba(15,15,20,0.2)] transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.93] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <Mic className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

// ── Note composer (text fallback until VoiceNoteRecorder lands) ──────────────

function NoteComposer({
  sessionId,
  onSaved,
  onError,
}: {
  sessionId: string;
  onSaved: (noteText: string) => void;
  onError: (message: string) => void;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) {
      onError("Note cannot be empty");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/coach/sessions/${sessionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ content: trimmed }),
      });
      const payload = (await res.json()) as
        | { success: true; data: { content: string } }
        | { success: false; error: string };
      if (!res.ok || !payload.success) {
        onError(payload.success === false ? payload.error : `Request failed (${res.status})`);
        return;
      }
      onSaved(payload.data.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error — try again";
      onError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <p className="text-sm text-[var(--muted)]">
        Capture what you saw. Visible to the athlete on their next session view.
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What did you see? What's the cue?"
        rows={5}
        autoFocus
        className="resize-none rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3.5 py-3 text-[15px] text-[var(--foreground)] outline-none focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setContent("")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3.5 py-1.5 text-[13px] text-[var(--foreground)] transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting || content.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--background)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          {submitting ? "Saving…" : "Save note"}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatKg(kg: number): string {
  const s = Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${s}kg`;
}

function extractMinutes(label: string): string {
  const m = label.match(/^(\d+)\s*MIN/i);
  return m ? `${m[1]} MIN` : label;
}

function computeThrowingTotals(block: CoachLaneDTO): {
  completed: number;
  prescribed: number;
} {
  let completed = 0;
  let prescribed = 0;
  for (const ex of block.exercises) {
    if (ex.implementKg == null) continue;
    prescribed += ex.prescribedThrows ?? ex.sets ?? 0;
    completed += ex.completedThrows ?? 0;
  }
  return { completed, prescribed };
}

function pickLastThrowSummary(
  block: CoachLaneDTO
): { distanceLabel: string; rpeLabel: string | null } | null {
  // We don't have throw timestamps in the DTO; show the average RPE of the
  // heaviest implement that has any throws as the live "last seen" pulse.
  const candidates = block.exercises
    .filter((e) => (e.completedThrows ?? 0) > 0)
    .sort((a, b) => (b.implementKg ?? 0) - (a.implementKg ?? 0));
  const ex = candidates[0];
  if (!ex || ex.implementKg == null) return null;
  return {
    distanceLabel: `${ex.completedThrows} thrown · ${formatKg(ex.implementKg)}`,
    rpeLabel: ex.averageRpe != null ? `RPE ${ex.averageRpe}` : null,
  };
}
