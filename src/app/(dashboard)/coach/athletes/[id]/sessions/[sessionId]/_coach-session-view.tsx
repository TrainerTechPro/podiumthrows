"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import Link from "next/link";
import {
  Bell,
  Settings2,
  Search,
  ChevronRight,
  Save,
  MessageSquare,
  Check,
  CheckCircle2,
  ArrowUpRight,
  ArrowRight,
  AlertTriangle,
  X,
} from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import { Sheet, useSheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import {
  validateCandidateBlocks,
  type CoachSessionDetailDTO,
  type CoachLaneDTO,
  type CoachExerciseDTO,
} from "@/lib/coach/session-detail";
import { CoachSessionMobile } from "./_coach-session-mobile";

interface Props {
  initial: CoachSessionDetailDTO;
}

/**
 * Viewport-conditional render. Below 768px the coach sees the sideline-glance
 * layout (read-only viewer, FAB for observation capture). At 768px+ the
 * editorial workspace below is rendered (drag/drop, inspector, ⌘K).
 */
export function CoachSessionDetailView({ initial }: Props) {
  const isMobile = useIsMobileViewport();
  if (isMobile) return <CoachSessionMobile initial={initial} />;
  return <CoachSessionDesktop initial={initial} />;
}

// SSR-safe matchMedia. Server and first client paint render the desktop tree;
// once the listener fires on a phone we swap to the mobile tree. The flash is
// bounded by the page's auth+fetch round-trip and is acceptable for a route
// that already requires server-side data loading.
function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

// In-flight edits the coach hasn't saved yet. Keyed by exercise id.
type PendingExerciseEdit = {
  blockId?: string;
  order?: number;
  sets?: number | null;
  reps?: string | null;
  weight?: string | null;
  rpe?: number | null;
  implementKg?: number | null;
  notes?: string | null;
};

function CoachSessionDesktop({ initial }: Props) {
  const [dto, setDto] = useState<CoachSessionDetailDTO>(initial);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    initial.blocks.find((b) => b.status === "active")?.exercises[0]?.id ?? null
  );
  const [pending, setPending] = useState<Record<string, PendingExerciseEdit>>({});
  const [pendingBlockOrder, setPendingBlockOrder] = useState<string[] | null>(null);
  const [validatorPulseDanger, setValidatorPulseDanger] = useState(false);
  const [violationTooltip, setViolationTooltip] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const noteSheet = useSheet(false);
  const { success, error: toastError, info } = useToast();

  const selectedExercise = useMemo(() => {
    for (const lane of dto.blocks) {
      const e = lane.exercises.find((x) => x.id === selectedExerciseId);
      if (e) return { exercise: e, lane };
    }
    return null;
  }, [dto.blocks, selectedExerciseId]);

  const hasPending = Object.keys(pending).length > 0 || pendingBlockOrder !== null;

  // Live validator state — recomputed against the current DTO + pending edits.
  // Re-runs whenever the candidate plan changes (drag/drop or sparse edit).
  const liveValidator = useMemo(() => {
    return computeLiveValidator(dto, pending, pendingBlockOrder);
  }, [dto, pending, pendingBlockOrder]);

  // Briefly red-flash the badge whenever liveValidator flips from valid → invalid.
  const wasValid = useRef(liveValidator.valid);
  useEffect(() => {
    if (wasValid.current && !liveValidator.valid) {
      setValidatorPulseDanger(true);
      const t = setTimeout(() => setValidatorPulseDanger(false), 900);
      return () => clearTimeout(t);
    }
    wasValid.current = liveValidator.valid;
  }, [liveValidator.valid]);

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
        context: "coach-session-detail",
        error: err,
      });
    }
  }, [dto.sessionId, dto.athleteProfileId]);

  async function handleSave() {
    if (!hasPending) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/coach/sessions/${dto.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          blockOrder: pendingBlockOrder,
          exerciseUpdates: Object.entries(pending).map(([id, p]) => ({ id, ...p })),
        }),
      });
      const payload = (await res.json()) as
        | { success: true; data: CoachSessionDetailDTO }
        | { success: false; error: string };

      if (!res.ok || !payload.success) {
        toastError(
          "Couldn't save",
          payload.success === false ? payload.error : `Request failed (${res.status})`
        );
        return;
      }

      setDto(payload.data);
      setPending({});
      setPendingBlockOrder(null);
      success("Session saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error — try again";
      toastError("Couldn't save", message);
    } finally {
      setSaving(false);
    }
  }

  // Drag/drop — native HTML5. Reject on the client when the move violates
  // Bondarchuk; never POST anything that wouldn't pass validation.
  const dragState = useRef<{ exerciseId: string; fromBlockId: string } | null>(null);

  function onExerciseDragStart(
    e: ReactDragEvent<HTMLDivElement>,
    exercise: CoachExerciseDTO,
    fromBlockId: string
  ) {
    dragState.current = { exerciseId: exercise.id, fromBlockId };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", exercise.id);
  }

  function onLaneDragOver(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onLaneDrop(e: ReactDragEvent<HTMLDivElement>, targetLaneId: string) {
    e.preventDefault();
    const drag = dragState.current;
    dragState.current = null;
    if (!drag) return;
    if (drag.fromBlockId === targetLaneId) return;

    // Build a candidate plan that moves this exercise into the target lane and
    // run the Bondarchuk validator. If invalid, reject right here — no POST,
    // no optimistic state, no surprise red after-the-fact.
    const candidate = projectCandidate(dto, pending, pendingBlockOrder, {
      moveExerciseId: drag.exerciseId,
      toBlockId: targetLaneId,
    });
    const result = validateCandidateBlocks(candidate);
    if (!result.valid) {
      const w = result.warnings[0];
      setViolationTooltip(`${w?.message ?? "Bondarchuk violation"} (Vol IV · p.114-117)`);
      setValidatorPulseDanger(true);
      setTimeout(() => setValidatorPulseDanger(false), 900);
      setTimeout(() => setViolationTooltip(null), 4500);
      info("Drop rejected — would violate Volume IV");
      return;
    }

    // Apply the move locally, mark pending.
    setPending((prev) => ({
      ...prev,
      [drag.exerciseId]: { ...prev[drag.exerciseId], blockId: targetLaneId },
    }));
    setDto((d) => moveExerciseInDto(d, drag.exerciseId, targetLaneId));
  }

  return (
    <div className="-mx-4 -mt-5 flex h-[calc(100dvh-4rem)] flex-col bg-[var(--background)] sm:-mx-6">
      {/* In-page top bar — breadcrumb + ⌘K + chrome icons */}
      <div className="flex h-13 items-center gap-4 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-5">
        <nav className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--muted)]">
          <Link href="/coach/athletes" className="hover:text-[var(--foreground)]">
            Roster
          </Link>
          <ChevronRight className="h-3 w-3 text-[var(--muted)]/60" aria-hidden="true" />
          <Link
            href={`/coach/athletes/${dto.athleteProfileId}`}
            className="hover:text-[var(--foreground)]"
          >
            {dto.athlete.name}
          </Link>
          <ChevronRight className="h-3 w-3 text-[var(--muted)]/60" aria-hidden="true" />
          <span className="text-[var(--foreground)]">{dto.scheduledDateLabel}</span>
        </nav>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("podium:open-command-palette"))}
          className="flex min-w-[260px] items-center gap-2 rounded-lg border border-[var(--card-border)] bg-surface-50 px-3 py-1.5 text-[12.5px] text-[var(--muted)] transition-colors hover:bg-surface-100 dark:bg-surface-900 dark:hover:bg-surface-800"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          <span>Search athletes, sessions, exercises</span>
          <span className="ml-auto rounded-md border border-[var(--card-border)] bg-surface-100 px-1.5 py-px font-mono text-[10px] text-[var(--muted)] dark:bg-surface-800">
            ⌘K
          </span>
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-surface-100 hover:text-[var(--foreground)] dark:hover:bg-surface-800"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Settings"
          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-surface-100 hover:text-[var(--foreground)] dark:hover:bg-surface-800"
        >
          <Settings2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {/* Canvas + inspector */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--background)] px-7 pb-8 pt-6">
          {/* ── Athlete header strip — TWO ROW ── */}
          <AthleteStrip
            dto={dto}
            saving={saving}
            hasPending={hasPending}
            onSave={handleSave}
            onNote={() => noteSheet.onOpen()}
          />

          {/* ── Section header with VOL IV validator pill ── */}
          <SectionHeader
            dto={dto}
            validator={liveValidator}
            pulseDanger={validatorPulseDanger}
            tooltip={violationTooltip}
          />

          {/* ── Block timeline ── */}
          <div className="flex flex-col gap-2.5">
            {dto.blocks.map((lane) => (
              <Lane
                key={lane.id}
                lane={lane}
                selectedExerciseId={selectedExerciseId}
                onSelect={(id) => setSelectedExerciseId(id)}
                onDragStart={onExerciseDragStart}
                onDragOver={onLaneDragOver}
                onDrop={(e) => onLaneDrop(e, lane.id)}
                pending={pending}
              />
            ))}
          </div>

          {!liveValidator.valid && liveValidator.warnings.length > 0 ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-3 rounded-2xl border border-danger-500/30 bg-danger-500/5 px-4 py-3 text-sm text-danger-500"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em]">
                  Volume IV violation
                </div>
                <div className="text-[13px] leading-relaxed">
                  {liveValidator.warnings[0]?.message}{" "}
                  <span className="font-mono text-[var(--muted)]">(Vol IV · p.114-117)</span>
                </div>
              </div>
            </div>
          ) : null}
        </main>

        {/* ── Right inspector ── */}
        <Inspector
          exercise={selectedExercise?.exercise ?? null}
          laneName={selectedExercise?.lane.name ?? null}
        />
      </div>

      <Sheet
        open={noteSheet.open}
        onClose={noteSheet.onClose}
        side="right"
        size="md"
        title="Add session note"
        ariaLabel="Add session note"
        className="!bg-[var(--surface-overlay)]"
      >
        <NoteComposer
          sessionId={dto.sessionId}
          onSaved={async (noteText) => {
            success("Note saved");
            // Update the inspector last-note immediately.
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

// ── Athlete strip ────────────────────────────────────────────────────────────

function AthleteStrip({
  dto,
  saving,
  hasPending,
  onSave,
  onNote,
}: {
  dto: CoachSessionDetailDTO;
  saving: boolean;
  hasPending: boolean;
  onSave: () => void;
  onNote: () => void;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="ident-row flex items-center gap-4 px-5 py-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[var(--card-border)] bg-gradient-to-br from-surface-300 to-surface-400 font-heading text-base font-bold text-[var(--foreground)] dark:from-surface-700 dark:to-surface-800">
          {dto.athlete.initials}
        </div>
        <div className="who min-w-0 flex-1">
          <h2
            className="truncate font-heading text-xl font-semibold leading-tight tracking-[-0.005em] text-[var(--foreground)]"
            title={dto.athlete.name}
          >
            {dto.athlete.name}
          </h2>
          <div
            className="mt-1 truncate font-mono text-[11.5px] tracking-[0.06em] text-[var(--muted)]"
            title={dto.athlete.meta}
          >
            {dto.athlete.meta}
          </div>
        </div>
        <div className="strip-actions ml-auto flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onNote}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Note
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!hasPending || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--foreground)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--background)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="stats-row flex items-center gap-5 border-t border-[var(--card-border)] bg-surface-50 px-5 py-3 dark:bg-surface-900/60">
        {dto.periodization ? (
          <div className="flex flex-1 min-w-[220px] flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Phase · {dto.periodization.phaseLabel}
            </span>
            <PerioTrack
              total={dto.periodization.totalWeeks}
              current={dto.periodization.currentWeek}
            />
            <div className="flex justify-between font-mono text-[10px] tracking-[0.04em] text-[var(--muted)]">
              <span>WK 1</span>
              <span className="font-medium text-[var(--foreground)]">
                WK {dto.periodization.currentWeek} / {dto.periodization.totalWeeks}
              </span>
              <span>WK {dto.periodization.totalWeeks}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-[220px]" />
        )}

        {dto.readiness ? (
          <>
            <Hairline />
            <Stat stat={dto.readiness} />
          </>
        ) : null}
        {dto.vsLast ? (
          <>
            <Hairline />
            <Stat stat={dto.vsLast} />
          </>
        ) : null}
      </div>
    </section>
  );
}

function PerioTrack({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
      {Array.from({ length: total }).map((_, i) => {
        const w = i + 1;
        const tone =
          w < current
            ? "bg-primary-500/40"
            : w === current
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
  );
}

function Hairline() {
  return <div className="h-9 w-px bg-[var(--card-border)]" aria-hidden="true" />;
}

function Stat({
  stat,
}: {
  stat: { label: string; value: string; tone: "neutral" | "success" | "warning" | "danger" };
}) {
  const toneClass =
    stat.tone === "success"
      ? "text-success-500"
      : stat.tone === "warning"
        ? "text-warning-500"
        : stat.tone === "danger"
          ? "text-danger-500"
          : "text-[var(--foreground)]";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">
        {stat.label}
      </span>
      <span className={`font-mono text-sm font-semibold tabular-nums tracking-wide ${toneClass}`}>
        {stat.value}
      </span>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  dto,
  validator,
  pulseDanger,
  tooltip,
}: {
  dto: CoachSessionDetailDTO;
  validator: { valid: boolean; warnings: { message: string }[] };
  pulseDanger: boolean;
  tooltip: string | null;
}) {
  const isValid = validator.valid;
  const tone = pulseDanger || !isValid ? "danger" : "success";
  return (
    <div className="mb-3.5 flex items-baseline justify-between px-0.5">
      <div className="flex items-center gap-3">
        <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]">
          Today&apos;s Session
        </h3>
        <div className="relative">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono text-[11px] font-medium tracking-[0.04em] transition-colors ${
              tone === "success"
                ? "border-success-500/25 bg-success-500/10 text-success-500"
                : "border-danger-500/30 bg-danger-500/10 text-danger-500"
            } ${pulseDanger ? "animate-danger-pulse" : ""}`}
            role="status"
          >
            {isValid ? (
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            )}
            VOL IV · {isValid ? "VALID" : "VIOLATION"}
          </span>
          {tooltip ? (
            <div
              role="tooltip"
              className="absolute left-0 top-[calc(100%+8px)] z-30 w-[320px] rounded-xl border border-[var(--card-border)] bg-[var(--surface-overlay)] p-3 text-[12px] leading-relaxed text-[var(--foreground)] shadow-lg"
            >
              {tooltip}
            </div>
          ) : null}
        </div>
      </div>
      <div className="font-mono text-[11px] tracking-[0.06em] text-[var(--muted)]">
        {dto.totalDurationMinutes} MIN · {dto.totalBlocks} BLOCKS ·{" "}
        <span className="font-medium text-[var(--foreground)]">
          {dto.completedBlocks} OF {dto.totalBlocks} COMPLETE
        </span>
      </div>
    </div>
  );
}

// ── Lane ─────────────────────────────────────────────────────────────────────

function Lane({
  lane,
  selectedExerciseId,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  pending,
}: {
  lane: CoachLaneDTO;
  selectedExerciseId: string | null;
  onSelect: (exerciseId: string) => void;
  onDragStart: (
    e: ReactDragEvent<HTMLDivElement>,
    exercise: CoachExerciseDTO,
    fromBlockId: string
  ) => void;
  onDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLDivElement>) => void;
  pending: Record<string, PendingExerciseEdit>;
}) {
  const isActive = lane.status === "active";
  const tagClass =
    lane.tag === "THROWING"
      ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
      : lane.tag === "STRENGTH"
        ? "bg-info-500/10 text-info-500"
        : "bg-surface-100 text-[var(--muted)] dark:bg-surface-800";

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-[var(--card-bg)] transition-colors ${
        isActive
          ? "border-primary-500/40 shadow-[0_1px_3px_rgba(15,15,20,0.04),0_0_0_1px_rgba(184,131,12,0.15)]"
          : "border-[var(--card-border)] hover:border-[var(--card-border)]/80"
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className={`flex items-center justify-between border-b border-[var(--card-border)] px-4 py-2.5 ${
          isActive ? "bg-primary-500/[0.04]" : "bg-surface-50 dark:bg-surface-900/40"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex min-w-[22px] items-center gap-1.5 font-mono text-[11px] font-semibold tracking-[0.1em] ${
              isActive ? "text-primary-500" : "text-[var(--muted)]"
            }`}
          >
            {isActive ? <PulseDot /> : null}
            {lane.badge}
          </span>
          <span className="font-heading text-[14px] font-semibold tracking-[0.005em] text-[var(--foreground)]">
            {lane.name}
          </span>
          <span
            className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] ${tagClass}`}
          >
            {lane.tag}
          </span>
        </div>
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.04em] text-[var(--muted)]">
          <span>{lane.durationLabel}</span>
          {lane.status === "complete" ? (
            <CheckCircle2
              className="h-3.5 w-3.5 text-success-500"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-2.5 px-4 py-3">
        {lane.exercises.length === 0 ? (
          <div className="w-full rounded-xl border border-dashed border-[var(--card-border)] py-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Drop an exercise here
          </div>
        ) : null}
        {lane.exercises.map((ex, i) => (
          <ExerciseLine
            key={ex.id}
            exercise={ex}
            isLast={i === lane.exercises.length - 1}
            laneIsActive={isActive}
            isSelected={selectedExerciseId === ex.id}
            onSelect={() => onSelect(ex.id)}
            onDragStart={(e) => onDragStart(e, ex, lane.id)}
            laneKind={lane.kind}
            isPending={pending[ex.id] != null}
          />
        ))}
      </div>
    </div>
  );
}

function ExerciseLine({
  exercise,
  isLast,
  laneIsActive,
  isSelected,
  onSelect,
  onDragStart,
  laneKind,
  isPending,
}: {
  exercise: CoachExerciseDTO;
  isLast: boolean;
  laneIsActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void;
  laneKind: CoachLaneDTO["kind"];
  isPending: boolean;
}) {
  const isThrowing = laneKind === "throwing";
  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        className={`group relative min-w-[168px] cursor-pointer rounded-xl border bg-[var(--card-bg)] px-3.5 py-3 transition-all ${
          isSelected
            ? "border-primary-500 bg-[var(--card-bg)] shadow-[0_0_0_3px_rgba(184,131,12,0.1)]"
            : "border-[var(--card-border)] hover:border-[var(--card-border)] hover:bg-surface-50 dark:hover:bg-surface-900/60"
        } ${isThrowing ? "" : "min-w-[220px]"}`}
        aria-label={`${exercise.name}, ${exercise.implementKg ?? ""}${exercise.implementKg ? "kg" : ""}`}
      >
        {isPending ? (
          <span
            className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-info-500"
            aria-label="Unsaved edit"
          />
        ) : null}

        <div className="mb-1.5 flex items-center justify-between">
          {isThrowing ? (
            <ImplementValue
              kg={exercise.implementKg}
              isHeaviest={exercise.isHeaviestInBlock}
              laneActive={laneIsActive}
            />
          ) : (
            <span className="font-heading text-[14px] font-semibold text-[var(--foreground)]">
              {exercise.name}
            </span>
          )}
          <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--muted)]">
            {isThrowing
              ? `×${exercise.sets ?? 0}`
              : `${exercise.sets ?? 0}×${exercise.reps ?? "?"}`}
          </span>
        </div>

        {isThrowing ? (
          <>
            <div className="mb-1.5 h-[3px] overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
              <div
                className="h-full rounded-full bg-primary-500 transition-[width] duration-300"
                style={{
                  width: `${
                    exercise.prescribedThrows && exercise.prescribedThrows > 0
                      ? Math.min(
                          100,
                          ((exercise.completedThrows ?? 0) / exercise.prescribedThrows) * 100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10.5px] tracking-[0.04em] text-[var(--muted)]">
              <span>
                <span className="font-medium text-[var(--foreground)]">
                  {exercise.completedThrows ?? 0}
                </span>{" "}
                / {exercise.prescribedThrows ?? 0} thrown
              </span>
              <span>
                {exercise.averageRpe != null
                  ? `RPE ${exercise.averageRpe}`
                  : exercise.rpe != null
                    ? `RPE ${exercise.rpe}`
                    : "—"}
              </span>
            </div>
          </>
        ) : (
          <div className="font-mono text-[11px] tracking-[0.03em] text-[var(--muted)]">
            {exercise.setsBreakdown ?? exercise.weight ?? "—"}
          </div>
        )}
      </div>
      {isThrowing && !isLast ? (
        <ArrowRight
          className="self-center text-[var(--muted)]/60"
          size={14}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}

function ImplementValue({
  kg,
  isHeaviest,
  laneActive,
}: {
  kg: number | null;
  isHeaviest: boolean;
  laneActive: boolean;
}) {
  if (kg == null) {
    return (
      <span className="font-mono text-[18px] font-semibold tabular-nums tracking-[-0.01em] text-[var(--muted)]">
        —
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 font-mono text-[18px] font-semibold tabular-nums tracking-[-0.01em] text-[var(--foreground)]">
      {isHeaviest ? (
        <span
          className="inline-block h-[5px] w-[5px] rounded-full bg-primary-500"
          style={
            laneActive
              ? { boxShadow: "0 0 6px rgba(255,200,0,0.45)", background: "#FFC800" }
              : undefined
          }
          aria-hidden="true"
        />
      ) : null}
      {formatKg(kg)}
    </span>
  );
}

// ── Inspector ────────────────────────────────────────────────────────────────

function Inspector({
  exercise,
  laneName,
}: {
  exercise: CoachExerciseDTO | null;
  laneName: string | null;
}) {
  if (!exercise) {
    return (
      <aside className="hidden w-[320px] shrink-0 overflow-y-auto custom-scrollbar border-l border-[var(--card-border)] bg-surface-50 px-5 py-6 dark:bg-surface-900/60 lg:block">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--muted)]">
          Selected exercise
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Click any exercise card to inspect correlation, history, prescription, and notes.
        </p>
      </aside>
    );
  }
  const corr = exercise.correlation;
  const title =
    exercise.implementKg != null
      ? `${exercise.name} · ${formatKg(exercise.implementKg)}`
      : exercise.name;

  return (
    <aside className="hidden w-[320px] shrink-0 overflow-y-auto custom-scrollbar border-l border-[var(--card-border)] bg-surface-50 px-5 py-6 dark:bg-surface-900/60 lg:block">
      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary-600 dark:text-primary-400">
        Selected exercise
      </div>
      <h2 className="mt-1 font-heading text-[19px] font-semibold tracking-[-0.005em] text-[var(--foreground)]">
        {title}
      </h2>
      <p className="mb-5 mt-1 text-[12.5px] text-[var(--muted)]">
        {laneName ? `${laneName}.` : ""}
      </p>

      {corr ? (
        <InspectorBlock label="Correlation to comp">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-[32px] font-semibold leading-none tabular-nums tracking-[-0.01em] text-[var(--foreground)]">
              {corr.coefficient.toFixed(2)}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] ${
                corr.band === "HIGH"
                  ? "bg-success-500/10 text-success-500"
                  : corr.band === "MEDIUM"
                    ? "bg-warning-500/10 text-warning-500"
                    : "bg-surface-200 text-[var(--muted)] dark:bg-surface-800"
              }`}
            >
              {corr.band} TRANSFER
            </span>
          </div>
          <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-success-500 to-amber-300"
              style={{ width: `${corr.coefficient * 100}%` }}
            />
          </div>
          <div className="font-mono text-[10px] tracking-[0.04em] text-[var(--muted)]">
            <span>
              {corr.population ? `${corr.population} · ` : ""}n={corr.sampleSize ?? "—"}
            </span>
          </div>
        </InspectorBlock>
      ) : (
        <InspectorBlock label="Correlation to comp">
          <p className="font-mono text-[11px] text-[var(--muted)]">
            No transfer data on file. Add coefficients in the Exercise Library to surface here.
          </p>
        </InspectorBlock>
      )}

      <InspectorBlock label="Prescribed">
        <KvRow k="Throws" v={exercise.prescribedThrows ?? exercise.sets ?? "—"} />
        <KvRow k="Target RPE" v={exercise.rpe != null ? `${exercise.rpe}` : "—"} />
        <KvRow k="Reps" v={exercise.reps ?? "—"} />
        {exercise.notes ? <KvRow k="Cue focus" v={exercise.notes} mono={false} /> : null}
      </InspectorBlock>

      <InspectorBlock label="Citations" hideBorder>
        <CitationRow label="Vol IV · p.114-117" />
        <CitationRow label="Comp seq study · 2019" />
      </InspectorBlock>
    </aside>
  );
}

function InspectorBlock({
  label,
  children,
  hideBorder,
}: {
  label: string;
  children: React.ReactNode;
  hideBorder?: boolean;
}) {
  return (
    <section
      className={`mb-5 pb-5 ${
        hideBorder ? "" : "border-b border-[var(--card-border)]"
      } last:mb-0 last:border-b-0 last:pb-0`}
    >
      <div className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </div>
      {children}
    </section>
  );
}

function KvRow({ k, v, mono = true }: { k: string; v: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--card-border)] py-1.5 text-[12.5px] last:border-b-0">
      <span className="text-[var(--muted)]">{k}</span>
      <span
        className={`font-medium tabular-nums text-[var(--foreground)] ${mono ? "font-mono" : ""}`}
      >
        {String(v)}
      </span>
    </div>
  );
}

function CitationRow({ label, href }: { label: string; href?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--card-border)] py-1.5 text-[12.5px] last:border-b-0">
      <span className="text-[var(--muted)]">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Open <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 text-[var(--muted)]">
          Open <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

// ── Note composer (Sheet body) ───────────────────────────────────────────────

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
    <div className="flex h-full flex-col gap-4 p-5">
      <p className="text-sm text-[var(--muted)]">
        Visible to this athlete with their next session view. Plain text only — no coach-private
        toggle yet.
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What did you see? What's the cue for next time?"
        rows={8}
        className="flex-1 resize-none rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20"
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

// ── Pulse dot (active lane) ──────────────────────────────────────────────────

function PulseDot() {
  return (
    <span
      className="relative inline-block h-1.5 w-1.5 rounded-full bg-primary-500 motion-safe:animate-pulse"
      style={{ boxShadow: "0 0 6px rgba(255,200,0,0.45)" }}
      aria-hidden="true"
    />
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatKg(kg: number): string {
  const s = Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${s}kg`;
}

function moveExerciseInDto(
  dto: CoachSessionDetailDTO,
  exerciseId: string,
  toBlockId: string
): CoachSessionDetailDTO {
  const blocks = dto.blocks.map((b) => ({ ...b, exercises: [...b.exercises] }));
  let moved: CoachExerciseDTO | null = null;
  for (const b of blocks) {
    const i = b.exercises.findIndex((e) => e.id === exerciseId);
    if (i >= 0) {
      moved = b.exercises.splice(i, 1)[0];
      break;
    }
  }
  if (!moved) return dto;
  const target = blocks.find((b) => b.id === toBlockId);
  if (!target) return dto;
  target.exercises = [...target.exercises, moved];
  return { ...dto, blocks };
}

/**
 * Project the candidate plan that would result if the proposed move were
 * applied on top of all in-flight pending edits. Used for live validation
 * BEFORE a drop is accepted.
 */
function projectCandidate(
  dto: CoachSessionDetailDTO,
  pending: Record<string, PendingExerciseEdit>,
  pendingBlockOrder: string[] | null,
  proposedMove: { moveExerciseId: string; toBlockId: string }
) {
  let blocks = dto.blocks.map((b) => ({
    name: b.name,
    blockType: b.kind,
    id: b.id,
    exercises: b.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      implementKg: e.implementKg,
      blockId: b.id,
    })),
  }));

  if (pendingBlockOrder && pendingBlockOrder.length > 0) {
    const indexById = new Map(pendingBlockOrder.map((id, i) => [id, i] as const));
    blocks = blocks.sort((a, b) => (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0));
  }

  // Apply pending edits.
  for (const [id, p] of Object.entries(pending)) {
    for (const block of blocks) {
      const ex = block.exercises.find((e) => e.id === id);
      if (!ex) continue;
      if (p.implementKg !== undefined) ex.implementKg = p.implementKg ?? null;
      if (p.blockId && p.blockId !== block.id) {
        block.exercises = block.exercises.filter((e) => e.id !== id);
        const target = blocks.find((b) => b.id === p.blockId);
        if (target) target.exercises.push(ex);
      }
    }
  }

  // Apply the proposed move.
  for (const block of blocks) {
    const i = block.exercises.findIndex((e) => e.id === proposedMove.moveExerciseId);
    if (i >= 0) {
      const [moved] = block.exercises.splice(i, 1);
      const target = blocks.find((b) => b.id === proposedMove.toBlockId);
      if (target) target.exercises.push(moved);
      break;
    }
  }

  return blocks.map((b) => ({
    name: b.name,
    blockType: b.blockType,
    exercises: b.exercises.map((e) => ({ name: e.name, implementKg: e.implementKg })),
  }));
}

function computeLiveValidator(
  dto: CoachSessionDetailDTO,
  pending: Record<string, PendingExerciseEdit>,
  pendingBlockOrder: string[] | null
) {
  // No pending changes — trust the loaded DTO.
  if (Object.keys(pending).length === 0 && !pendingBlockOrder) {
    return dto.validator;
  }
  // Re-validate against the current DTO with edits applied.
  const projected = projectCandidate(dto, pending, pendingBlockOrder, {
    moveExerciseId: "",
    toBlockId: "",
  });
  return validateCandidateBlocks(projected);
}
