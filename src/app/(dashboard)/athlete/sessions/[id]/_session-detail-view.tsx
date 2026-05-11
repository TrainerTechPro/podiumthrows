"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Target,
  Dumbbell,
  CircleDot,
  Lock,
  Mic,
  Check,
  CheckCircle2,
  TrendingUp,
  Flame,
} from "lucide-react";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";
import type {
  SessionDetailDTO,
  SessionBlock,
  ThrowHistoryEntry,
} from "@/lib/athlete/session-detail";

interface Props {
  initial: SessionDetailDTO;
}

type DistanceInput = string;
type RpeInput = number | null;

/**
 * Athlete-side Session Detail screen.
 *
 * Layout (top → bottom): in-page topbar, hero, active block, locked pills,
 * sticky session-progress bar above the shell tab bar.
 *
 * Interaction model: the active block is the only block that takes input.
 * Marking a throw is optimistic — the UI swaps to a confirmation card and the
 * implement counters advance immediately, then the API fires the toast (and
 * PR overlay if applicable). On API failure we revert and surface the error.
 */
export function SessionDetailView({ initial }: Props) {
  const [dto, setDto] = useState<SessionDetailDTO>(initial);
  const { celebration, success, error: toastError, info } = useToast();

  // PR overlay state — fires AFTER the API confirms the PR.
  const [prOverlay, setPrOverlay] = useState<{
    show: boolean;
    distance: number;
    event: string;
    previousBest: number | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/athlete/sessions/${dto.id}`, { cache: "no-store" });
      const payload = (await res.json()) as
        | { success: true; data: SessionDetailDTO }
        | { success: false; error: string };
      if (!res.ok || !payload.success) return;
      setDto(payload.data);
    } catch (err) {
      // ok: best-effort refresh — optimistic update already shipped the UI
      logger.warn("Session detail refresh failed", {
        context: "athlete-session-detail",
        error: err,
      });
    }
  }, [dto.id]);

  const allDone = dto.blocks.length > 0 && dto.blocks.every((b) => b.status === "complete");
  const progressPct =
    dto.totalBlocks > 0
      ? Math.min(100, Math.round((dto.completedBlocks / dto.totalBlocks) * 100))
      : 0;
  const dateLabel = useMemo(() => formatHeaderDate(dto.scheduledISO), [dto.scheduledISO]);

  return (
    <div className="relative -mx-4 min-h-[calc(100dvh-4rem)] pb-40 sm:-mx-6">
      {/* Hero — the shell's top bar already provides nav chrome, so the session
          identity (date + event + headline) lives directly inside the hero. */}
      <section className="px-6 pb-4 pt-7">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {dateLabel}
          {dto.weekLabel ? ` · ${dto.weekLabel}` : ""}
        </div>
        <span className="mb-3.5 inline-flex items-center gap-1.5 rounded-full border border-primary-500/20 bg-primary-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-500">
          <Target className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          {dto.eventLabel}
        </span>
        <h1 className="mb-2.5 font-heading text-[28px] font-semibold leading-[1.18] tracking-[-0.01em] text-[var(--foreground)]">
          {dto.headline}
        </h1>
        <p className="text-sm leading-[1.55] text-[var(--muted)]">
          {dto.prescription.map((tok, i) =>
            tok.kind === "implement" ? (
              <ImplementChip key={i} value={tok.value} />
            ) : (
              <span key={i}>{tok.value}</span>
            )
          )}
        </p>
      </section>

      {/* Block stack */}
      <div className="space-y-2">
        {dto.blocks.map((b) =>
          b.status === "active" ? (
            <ActiveBlockCard
              key={b.id}
              block={b}
              sessionId={dto.id}
              onLogged={async (result) => {
                if (result.kind === "pr") {
                  setPrOverlay({
                    show: true,
                    distance: result.distance,
                    event: result.event,
                    previousBest: result.previousBest,
                  });
                  celebration("New Personal Best!", {
                    description: result.event,
                    highlight: `${result.distance.toFixed(2)}m`,
                  });
                } else if (result.kind === "throw") {
                  success(
                    "Throw logged",
                    typeof result.distance === "number"
                      ? `${result.distance.toFixed(2)}m · RPE ${result.rpe ?? "—"}`
                      : undefined
                  );
                }
                await refresh();
              }}
              onLogError={(message) => toastError("Couldn't log throw", message)}
              onVoiceMemo={() => info("Voice notes — saving in v0.4")}
            />
          ) : (
            <LockedBlockPill key={b.id} block={b} />
          )
        )}
        {allDone ? (
          <div className="mx-4 mt-4 rounded-2xl border border-primary-500/30 bg-primary-500/5 px-5 py-6 text-center">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-500">
              Session complete
            </div>
            <h2 className="font-heading text-lg font-semibold text-[var(--foreground)]">
              Every block done. Lock it in.
            </h2>
            <Link
              href={`/athlete/sessions/${dto.id}/recap`}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-surface-950 shadow-sm transition-colors hover:bg-primary-600"
            >
              Wrap up &amp; recap
            </Link>
          </div>
        ) : null}
      </div>

      {/* Sticky bottom progress — sits above the shell tab bar. Tab bar is
          64px + safe-area; offset matches so the progress doesn't tuck under. */}
      <div
        className="pointer-events-none fixed inset-x-0 z-10 mx-auto max-w-2xl bg-gradient-to-b from-transparent via-[var(--background)]/80 to-[var(--background)] px-5 pb-4 pt-7 sm:max-w-none"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="pointer-events-auto">
          <div className="mb-2.5 flex items-center justify-between px-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Session Progress
            </span>
            <span className="font-mono text-[11px] font-medium tabular-nums text-[var(--foreground)]">
              {dto.completedBlocks} of {dto.totalBlocks} blocks
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-300 shadow-[0_0_10px_rgba(255,200,0,0.35)] transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            />
          </div>
        </div>
      </div>

      {prOverlay ? (
        <PRCelebration
          show={prOverlay.show}
          onDismiss={() => setPrOverlay(null)}
          event={prOverlay.event}
          distance={prOverlay.distance}
          unit="m"
        />
      ) : null}
    </div>
  );
}

// ── Implement chip (inline in prescription) ──────────────────────────────────

function ImplementChip({ value }: { value: string }) {
  return (
    <span className="mx-0.5 inline-block rounded-md border border-[var(--card-border)] bg-white/[0.03] px-1.5 py-px font-mono text-[13px] font-medium text-[var(--foreground)]">
      {value}
    </span>
  );
}

// ── Active block ─────────────────────────────────────────────────────────────

type LogResult =
  | { kind: "throw"; distance: number | null; rpe: number | null }
  | {
      kind: "pr";
      distance: number;
      event: string;
      previousBest: number | null;
    };

function ActiveBlockCard({
  block,
  sessionId,
  onLogged,
  onLogError,
  onVoiceMemo,
}: {
  block: SessionBlock;
  sessionId: string;
  onLogged: (result: LogResult) => void;
  onLogError: (message: string) => void;
  onVoiceMemo: () => void;
}) {
  const [distanceInput, setDistanceInput] = useState<DistanceInput>("");
  const [rpe, setRpe] = useState<RpeInput>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justLogged, setJustLogged] = useState<{
    distance: number | null;
    rpe: number | null;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const event = useMemo(() => guessEventFromBlock(block), [block]);
  const currentImpl =
    block.implements.find((c) => c.isCurrent) ?? block.implements.find((c) => !c.done);
  const totalDoneInBlock = block.completedThrows;
  const totalInBlock = block.prescribedThrows;

  // Empty-string vs zero must be distinguishable — see CLAUDE.md rule #3.
  const distanceNumber = parseNumeric(distanceInput);
  const lastInImplement = (() => {
    if (!currentImpl) return null;
    const history = block.history.filter((h) => h.implementKg === currentImpl.weightKg);
    return history[history.length - 1] ?? null;
  })();

  const delta =
    distanceNumber != null && lastInImplement?.distance != null
      ? distanceNumber - lastInImplement.distance
      : null;

  const canSubmit =
    !submitting &&
    !!event &&
    !!currentImpl &&
    !currentImpl.done &&
    distanceNumber !== null &&
    distanceNumber > 0;

  if (block.invalidAscending) {
    return (
      <div className="mx-4 rounded-2xl border border-danger-500/40 bg-danger-500/5 p-5 text-sm text-danger-500">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
          Block invalid
        </div>
        Implements in this block ascend in weight. The Bondarchuk sequencing rule requires heavy →
        light. Ask your coach to repair the block.
      </div>
    );
  }

  async function handleMarkThrown() {
    if (!event || !currentImpl) return;
    if (distanceNumber === null) return;

    // Precondition guard (CLAUDE.md rule #8): make sure we have what we need.
    if (currentImpl.done) {
      onLogError("This implement is already complete.");
      return;
    }

    setSubmitting(true);
    const optimisticDistance = distanceNumber;
    const optimisticRpe = rpe;
    setJustLogged({ distance: optimisticDistance, rpe: optimisticRpe });

    try {
      const res = await fetch(`/api/athlete/sessions/${sessionId}/throws`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          event,
          implementKg: currentImpl.weightKg,
          distance: optimisticDistance,
          rpe: optimisticRpe,
        }),
      });
      const payload = (await res.json()) as
        | {
            success: true;
            data: {
              throw: { isPersonalBest: boolean; distance: number | null };
              previousBest: number | null;
            };
          }
        | { success: false; error: string };

      if (!res.ok || !payload.success) {
        onLogError(payload.success === false ? payload.error : `Request failed (${res.status})`);
        setJustLogged(null);
        return;
      }

      // Reset input for next throw.
      setDistanceInput("");
      setRpe(null);

      if (payload.data.throw.isPersonalBest && payload.data.throw.distance != null) {
        onLogged({
          kind: "pr",
          distance: payload.data.throw.distance,
          event,
          previousBest: payload.data.previousBest,
        });
      } else {
        onLogged({
          kind: "throw",
          distance: optimisticDistance,
          rpe: optimisticRpe,
        });
      }

      // Hold the visual confirmation card briefly, then collapse so the next
      // throw's entry surface is visible.
      setTimeout(() => setJustLogged(null), 1400);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error — try again";
      onLogError(message);
      setJustLogged(null);
    } finally {
      setSubmitting(false);
    }
  }

  // Throw counter — within the current implement.
  const throwsDoneInImpl = currentImpl?.completed ?? 0;
  const throwsInImpl = currentImpl?.prescribed ?? 0;
  const counterLabel = currentImpl
    ? `Throw ${throwsDoneInImpl + 1} of ${throwsInImpl} · ${formatKg(currentImpl.weightKg)}`
    : `Block · ${totalDoneInBlock} of ${totalInBlock}`;

  return (
    <div className="relative mx-4 animate-fade-slide-in overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)]">
      {/* gold top hairline — the active marker */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/45 to-transparent" />

      <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 pb-3.5 pt-4.5">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary-500">
            <PulseDot />
            Block {block.order + 1} · Active
          </div>
          <div className="font-heading text-[17px] font-semibold tracking-[0.005em] text-[var(--foreground)]">
            {block.name}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {block.implements.map((c) => (
            <ImplementWeightChip key={c.weightKg} chip={c} />
          ))}
        </div>
      </div>

      {justLogged ? (
        <div className="px-5 pb-6 pt-5">
          <div
            role="status"
            className="flex animate-spring-up items-center gap-3 rounded-2xl border border-success-500/30 bg-success-500/8 px-4 py-4"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-success-500/15 text-success-500">
              <Check className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success-500">
                Logged
              </div>
              <div className="font-heading text-base font-semibold text-[var(--foreground)]">
                {justLogged.distance != null
                  ? `${justLogged.distance.toFixed(2)}m`
                  : "Throw recorded"}
                {justLogged.rpe != null ? (
                  <span className="ml-2 font-mono text-xs font-normal text-[var(--muted)]">
                    RPE {justLogged.rpe}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 pb-5 pt-4.5">
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {counterLabel}
          </div>

          {/* Distance — tap to focus the hidden input; NumberFlow renders the
              live value. The input is the source of truth; the display mirrors. */}
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="my-1 flex w-full items-baseline gap-2 text-left"
            aria-label="Edit distance"
          >
            <span className="font-mono text-[60px] font-semibold leading-none tabular-nums tracking-[-0.025em] text-[var(--foreground)]">
              <NumberFlow value={distanceNumber ?? 0} decimals={2} duration={350} />
            </span>
            <span className="font-mono text-[22px] font-medium text-[var(--muted)]">m</span>
            {delta != null ? (
              <span
                className={`ml-auto inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px] tabular-nums ${
                  delta >= 0
                    ? "border-success-500/25 bg-success-500/10 text-success-500"
                    : "border-danger-500/25 bg-danger-500/10 text-danger-500"
                }`}
              >
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
                {delta >= 0 ? "+" : ""}
                <AnimatedNumber value={delta} decimals={2} duration={600} />
              </span>
            ) : null}
          </button>

          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={distanceInput}
            onChange={(e) => setDistanceInput(sanitizeDecimal(e.target.value))}
            aria-label="Distance in meters"
            className="mb-4 w-full rounded-xl border border-[var(--card-border)] bg-surface-50 px-4 py-2.5 font-mono text-base tabular-nums text-[var(--foreground)] outline-none focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/20 dark:bg-surface-900"
          />

          <RpeRow value={rpe} onChange={setRpe} />

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2.5">
            <Button
              variant="primary"
              size="lg"
              onClick={handleMarkThrown}
              disabled={!canSubmit}
              loading={submitting}
              leftIcon={
                <Check className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden="true" />
              }
              className="!h-14 !rounded-2xl !text-base"
            >
              Mark Thrown
            </Button>
            <button
              type="button"
              onClick={onVoiceMemo}
              aria-label="Add voice memo"
              className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--card-border)] bg-surface-50 text-[var(--foreground)] transition-colors hover:bg-surface-100 dark:bg-surface-900 dark:hover:bg-surface-800"
            >
              <Mic className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {block.history.length > 0 ? (
        <ThrowsHistory
          entries={block.history}
          highlightImplementKg={currentImpl?.weightKg ?? null}
        />
      ) : null}
    </div>
  );
}

// ── Implement weight chip (in active block header) ───────────────────────────

function ImplementWeightChip({
  chip,
}: {
  chip: { weightKg: number; isCurrent: boolean; done: boolean };
}) {
  if (chip.isCurrent) {
    return (
      <span className="rounded-[10px] bg-primary-500 px-2.5 py-1.5 font-mono text-[11px] font-semibold tabular-nums text-surface-950 shadow-[0_0_16px_rgba(255,200,0,0.3)]">
        {formatKg(chip.weightKg)}
      </span>
    );
  }
  return (
    <span
      className={`rounded-[10px] border border-[var(--card-border)] px-2.5 py-1.5 font-mono text-[11px] font-medium tabular-nums ${
        chip.done
          ? "bg-surface-100 text-[var(--muted)] line-through dark:bg-surface-800"
          : "bg-surface-100 text-[var(--muted)] dark:bg-surface-800"
      }`}
    >
      {formatKg(chip.weightKg)}
    </span>
  );
}

// ── RPE row ─────────────────────────────────────────────────────────────────

function RpeRow({ value, onChange }: { value: RpeInput; onChange: (v: number) => void }) {
  const fillPct = value != null ? (value / 10) * 100 : 0;
  const tone =
    value == null
      ? "text-[var(--muted)]"
      : value <= 4
        ? "text-success-500"
        : value <= 7
          ? "text-warning-500"
          : "text-danger-500";

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-[var(--card-border)] bg-surface-50 px-4 py-3.5 dark:bg-surface-900">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
        RPE
      </span>
      <div className="relative flex-1">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Rate of perceived exertion, 1 to 10"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-success-500 via-warning-500 to-danger-500 shadow-[0_0_12px_rgba(255,136,0,0.4)] transition-[width] duration-200"
            style={{ width: `${fillPct}%` }}
          />
        </div>
        {value != null ? (
          <div
            className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-warning-500 bg-[var(--foreground)] shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            style={{ left: `${fillPct}%` }}
          />
        ) : null}
      </div>
      <NumberFlow
        value={value ?? 0}
        decimals={0}
        duration={200}
        className={`min-w-[28px] text-right font-mono text-[22px] font-semibold tabular-nums ${tone}`}
      />
    </div>
  );
}

// ── Throws history ──────────────────────────────────────────────────────────

function ThrowsHistory({
  entries,
  highlightImplementKg,
}: {
  entries: ThrowHistoryEntry[];
  highlightImplementKg: number | null;
}) {
  const grouped = entries.filter((e) =>
    highlightImplementKg != null ? e.implementKg === highlightImplementKg : true
  );
  if (grouped.length === 0) return null;
  return (
    <div className="border-t border-[var(--card-border)] bg-white/[0.012] px-5 py-4">
      <div className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">
        Previous throws · {highlightImplementKg != null ? formatKg(highlightImplementKg) : "all"}
      </div>
      <ul className="divide-y divide-[var(--card-border)]">
        {grouped.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2.5 last:pb-0 first:pt-0">
            <div className="flex items-center gap-3 font-mono text-[13px]">
              <CheckCircle2 className="h-4 w-4 text-success-500" aria-hidden="true" />
              <span className="min-w-[16px] text-[11px] text-[var(--muted)] tabular-nums">
                {String(t.number).padStart(2, "0")}
              </span>
              <span className="font-medium tabular-nums text-[var(--foreground)]">
                {t.distance != null ? `${t.distance.toFixed(2)}m` : "—"}
              </span>
              {t.isPersonalBest ? (
                <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-primary-500/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-primary-500">
                  <Flame className="h-3 w-3" aria-hidden="true" /> PR
                </span>
              ) : null}
            </div>
            <span className="font-mono text-[11px] tracking-[0.04em] text-[var(--muted)]">
              {t.rpe != null ? `RPE ${t.rpe}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Locked / completed block pill ────────────────────────────────────────────

function LockedBlockPill({ block }: { block: SessionBlock }) {
  const Icon =
    block.kind === "throwing"
      ? Target
      : block.kind === "strength"
        ? Dumbbell
        : block.kind === "warmup"
          ? Flame
          : CircleDot;
  const isComplete = block.status === "complete";

  return (
    <div
      className={`mx-4 flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-colors ${
        isComplete
          ? "border-success-500/25 bg-success-500/5"
          : "border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-surface-50 dark:hover:bg-surface-800/60"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid h-9 w-9 place-items-center rounded-[10px] border ${
            isComplete
              ? "border-success-500/30 bg-success-500/10 text-success-500"
              : "border-[var(--card-border)] bg-surface-100 text-[var(--muted)] dark:bg-surface-800"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--muted)]">
            {block.badge}
          </div>
          <div className="mt-0.5 font-heading text-sm font-semibold tracking-[0.005em] text-[var(--foreground)]">
            {block.kind === "throwing" && block.implements.length > 0
              ? block.implements.map((c) => formatKg(c.weightKg)).join(" → ")
              : (block.summary ?? block.name)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {isComplete ? (
          <>
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Done
          </>
        ) : (
          <>
            <Lock className="h-3 w-3" aria-hidden="true" />
            Locked
          </>
        )}
      </div>
    </div>
  );
}

// ── Pulsing dot ─────────────────────────────────────────────────────────────

function PulseDot() {
  return (
    <span
      className="relative inline-block h-1.5 w-1.5 rounded-full bg-primary-500 motion-safe:animate-pulse"
      style={{ boxShadow: "0 0 10px rgba(255,200,0,0.5)" }}
      aria-hidden="true"
    />
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Distinguishes "" / null from 0. parseFloat(s) || null collapses 0 → null and
 * has caused the exact bug CLAUDE.md rule #3 calls out.
 */
function parseNumeric(input: string): number | null {
  if (input === "" || input == null) return null;
  const n = parseFloat(input);
  return Number.isFinite(n) ? n : null;
}

/** Strip non-numeric characters except a single decimal point. */
function sanitizeDecimal(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

function formatKg(kg: number): string {
  const s = Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${s}kg`;
}

function formatHeaderDate(iso: string): string {
  const d = new Date(iso);
  const dow = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = d.getDate();
  return `${dow} · ${month} ${day}`;
}

function guessEventFromBlock(block: SessionBlock): string | null {
  // For now, infer from the active block's first throw history (if any) or fall
  // back to the implement weight matching a known competition weight. The page
  // will pass through whatever we send — if we get this wrong the API rejects.
  const fromHistory = block.history.find((h) => h.implementKg)?.implementKg;
  const w = fromHistory ?? block.implements[0]?.weightKg;
  if (w == null) return null;
  // Lightweight inference: 7.26kg / 6kg / 5kg → HAMMER (also SHOT_PUT 7.26),
  // 2kg / 1.75kg → DISCUS, 0.8kg / 0.6kg → JAVELIN, 4kg / 3kg → SHOT_PUT (W).
  if (w >= 4) return w === 7.26 || w === 6 || w === 9 || w === 8 ? "HAMMER" : "SHOT_PUT";
  if (w >= 1.5) return "DISCUS";
  if (w >= 0.5) return "JAVELIN";
  return null;
}
