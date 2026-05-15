"use client";

/**
 * Athlete dashboard streak block — the daily ritual surface.
 *
 * Three states this component handles:
 *   1. Active streak → tappable flame + day count + snowflake (freeze) button
 *      next to it. Tap the flame to open the detail sheet.
 *   2. In rebuild → gentle "Rebuild from day 1 today" card. No guilt trip,
 *      no shaming copy, no big numbers. The card disappears the instant the
 *      athlete logs anything (the engine clears `streakBrokenAt`).
 *   3. No streak yet → render nothing. We don't sell streaks before they
 *      exist; the next qualifying action will create one and this block
 *      will appear naturally on the next page load.
 *
 * Server passes initial state from `getStreakState`. Client re-fetches via
 * /api/athlete/streak-status only when the detail sheet opens (to refresh
 * freezesAvailable after the cron has potentially refilled).
 */

import { useState, useTransition } from "react";
import { Flame, Snowflake, Loader2 } from "lucide-react";
import { Sheet, useSheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { csrfHeaders } from "@/lib/csrf-client";
import { logger } from "@/lib/logger";

export type StreakBlockProps = {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  todayCovered: boolean;
  isInRebuild: boolean;
  lastBrokenStreakDays: number;
};

type HistoryDay = { date: string; kind: "active" | "frozen" | "inactive" };

export function StreakBlock(props: StreakBlockProps) {
  const detail = useSheet(false);
  const [history, setHistory] = useState<HistoryDay[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [freezeMutating, startFreezeMutation] = useTransition();
  const [optimistic, setOptimistic] = useState({
    freezesAvailable: props.freezesAvailable,
    todayCovered: props.todayCovered,
  });
  const toast = useToast();

  const showFlame = props.currentStreak > 0;
  const showRebuild = props.isInRebuild && props.currentStreak === 0;

  if (!showFlame && !showRebuild) return null;

  async function openDetail() {
    detail.onOpen();
    if (history !== null) return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/athlete/streak/history", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as {
        success: boolean;
        data?: { days: HistoryDay[] };
      };
      if (payload.success && payload.data) setHistory(payload.data.days);
    } catch (err) {
      logger.debug("streak history fetch failed", {
        context: "ui",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleFreezeClick() {
    if (freezeMutating) return;
    if (optimistic.freezesAvailable < 1) {
      toast.warning(
        "Out of freezes for the week",
        "Your freeze refills Sunday — log a session today to extend the streak."
      );
      return;
    }
    if (optimistic.todayCovered) {
      toast.info("Already covered today", "You don't need a freeze — today is logged.");
      return;
    }

    startFreezeMutation(async () => {
      const previous = optimistic;
      setOptimistic({
        freezesAvailable: previous.freezesAvailable - 1,
        todayCovered: true,
      });

      try {
        const res = await fetch("/api/athlete/streak/freeze", {
          method: "POST",
          headers: { ...csrfHeaders() },
        });
        const payload = (await res.json()) as {
          success: boolean;
          error?: string;
          data?: { freezesAvailable: number };
        };

        if (!res.ok || !payload.success) {
          setOptimistic(previous);
          toast.error(
            "Couldn't apply freeze",
            payload.error ?? "Network error — please try again."
          );
          return;
        }

        if (payload.data) {
          setOptimistic((s) => ({ ...s, freezesAvailable: payload.data!.freezesAvailable }));
        }
        toast.success("Rest day banked", "Your streak stays intact. See you tomorrow.");
      } catch (err) {
        setOptimistic(previous);
        toast.error(
          "Couldn't apply freeze",
          err instanceof Error ? err.message : "Network error — please try again."
        );
      }
    });
  }

  return (
    <>
      {showRebuild && <RebuildCard previousDays={props.lastBrokenStreakDays} />}

      {showFlame && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openDetail}
            aria-label={`View streak history — ${props.currentStreak} day streak`}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 -mx-2.5 -my-1 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-sunken)] active:scale-95 transition-[background-color,transform] duration-100"
          >
            <Flame
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="text-[var(--color-brand)]"
              style={{
                filter: optimistic.todayCovered
                  ? "drop-shadow(0 0 4px var(--color-brand-strong))"
                  : undefined,
              }}
            />
            <span className="tabular-nums">{props.currentStreak}-day streak</span>
          </button>
          <FreezeButton
            available={optimistic.freezesAvailable}
            disabled={freezeMutating}
            mutating={freezeMutating}
            onClick={handleFreezeClick}
          />
        </div>
      )}

      <Sheet
        open={detail.open}
        onClose={detail.onClose}
        side="bottom"
        size="md"
        title="Your streak"
        description={`Longest ever: ${props.longestStreak} days`}
      >
        <StreakDetailBody
          currentStreak={props.currentStreak}
          longestStreak={props.longestStreak}
          freezesAvailable={optimistic.freezesAvailable}
          history={history}
          loading={historyLoading}
        />
      </Sheet>
    </>
  );
}

/* ─── Rebuild card ───────────────────────────────────────────────────────── */

function RebuildCard({ previousDays }: { previousDays: number }) {
  const headline =
    previousDays >= 7 ? `That ${previousDays}-day run was real.` : "A new day, a new start.";
  return (
    <section
      aria-label="Rebuild your streak"
      className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--color-brand-subtle)" }}
        >
          <Flame
            size={20}
            strokeWidth={1.75}
            aria-hidden="true"
            style={{ color: "var(--color-brand)" }}
          />
        </div>
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold text-[var(--color-text-primary)]">
            {headline}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Rebuild from day 1 today — every streak starts once. Anything counts: a check-in, a
            single throw, a session.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Freeze (snowflake) button ──────────────────────────────────────────── */

function FreezeButton({
  available,
  disabled,
  mutating,
  onClick,
}: {
  available: number;
  disabled: boolean;
  mutating: boolean;
  onClick: () => void;
}) {
  const dim = available < 1;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        available > 0
          ? `Take a rest day — ${available} freeze available`
          : "No freezes available — refills Sunday"
      }
      className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[var(--color-border-default)] text-micro font-semibold tabular-nums transition-[transform,background-color] duration-100 active:scale-90 disabled:opacity-60 disabled:active:scale-100"
      style={{
        color: dim ? "var(--color-text-secondary)" : "var(--color-brand-strong)",
        backgroundColor: dim ? "transparent" : "var(--color-brand-subtle)",
      }}
    >
      {mutating ? (
        <Loader2 size={12} strokeWidth={2.25} aria-hidden="true" className="animate-spin" />
      ) : (
        <Snowflake size={12} strokeWidth={2.25} aria-hidden="true" />
      )}
    </button>
  );
}

/* ─── Detail sheet body ──────────────────────────────────────────────────── */

function StreakDetailBody({
  currentStreak,
  longestStreak,
  freezesAvailable,
  history,
  loading,
}: {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  history: HistoryDay[] | null;
  loading: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Headline numbers */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Current" value={currentStreak} suffix="d" />
        <Stat label="Best" value={longestStreak} suffix="d" />
        <Stat label="Freezes" value={freezesAvailable} suffix="/wk" />
      </div>

      {/* Heatmap */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)] mb-2">
          Last 30 days
        </h3>
        {loading && history === null ? (
          <div className="h-20 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="h-5 rounded-sm bg-[var(--color-bg-surface-sunken)] animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : history ? (
          <ol className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-1.5">
            {history.map((d) => (
              <li
                key={d.date}
                title={`${d.date}: ${d.kind}`}
                aria-label={`${d.date}: ${d.kind}`}
                className="h-5 rounded-sm"
                style={{
                  backgroundColor:
                    d.kind === "active"
                      ? "var(--color-brand)"
                      : d.kind === "frozen"
                        ? "var(--color-brand-subtle)"
                        : "var(--color-bg-surface-sunken)",
                  border: d.kind === "frozen" ? "1px solid var(--color-brand-strong)" : undefined,
                }}
              />
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            History unavailable right now.
          </p>
        )}
        <div className="mt-2 flex items-center gap-3 text-nano text-[var(--color-text-secondary)]">
          <Legend color="var(--color-brand)" label="Active" />
          <Legend
            color="var(--color-brand-subtle)"
            label="Frozen"
            border="var(--color-brand-strong)"
          />
          <Legend color="var(--color-bg-surface-sunken)" label="Off" />
        </div>
      </div>

      {/* Mechanic explainer */}
      <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        <p>
          Any qualifying action keeps your streak alive: a check-in, a throw, or a session. One per
          day counts.
        </p>
        <p className="mt-2">
          Need a real rest day? Tap the snowflake — your streak holds. You get one freeze per week
          (refills every Sunday).
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-surface-sunken)] p-3 text-center">
      <div className="text-nano uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 font-heading font-bold text-2xl text-[var(--color-text-primary)] tabular-nums">
        {value}
        {suffix && (
          <span className="text-base font-semibold text-[var(--color-text-secondary)] ml-0.5">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded-sm"
        style={{ backgroundColor: color, border: border ? `1px solid ${border}` : undefined }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
