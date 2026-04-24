"use client";

/**
 * Post-Session Recap Client
 * Full-screen celebration/summary shown after a training session completes.
 *
 * Sections (in order):
 *   1. Header + exit
 *   2. Hero stats
 *   3. Personal records (if any)
 *   4. Comparison to last session
 *   5. Streak tracker
 *   6. Top throw with share
 *   7. Wellness check-in (3 emoji x 3 questions)
 *   8. Footer CTAs
 *
 * Animation: framer-motion for the staggered entrance + PRCelebration overlay
 * for the PR splash. All motion respects prefers-reduced-motion.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence, type Variants } from "framer-motion";
import {
  X,
  Trophy,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Share2,
  Send,
  Check,
  Sparkles,
  Target,
} from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { csrfHeaders } from "@/lib/csrf-client";
import type { SessionRecap, WellnessValue } from "@/lib/data/session-recap";
import { logger } from "@/lib/logger";

/* ─── Types & constants ──────────────────────────────────────────────────── */

type WellnessKey = "legs" | "energy" | "focus";

type WellnessOption = {
  value: WellnessValue;
  emoji: string;
  label: string;
};

const WELLNESS_OPTIONS: WellnessOption[] = [
  { value: 1, emoji: "😴", label: "Rough" },
  { value: 2, emoji: "🙂", label: "OK" },
  { value: 3, emoji: "🔥", label: "Great" },
];

const WELLNESS_QUESTIONS: { key: WellnessKey; prompt: string }[] = [
  { key: "legs", prompt: "Legs" },
  { key: "energy", prompt: "Energy" },
  { key: "focus", prompt: "Focus" },
];

function formatEventLabel(event: string): string {
  const labels: Record<string, string> = {
    SHOT_PUT: "Shot Put",
    DISCUS: "Discus",
    HAMMER: "Hammer",
    JAVELIN: "Javelin",
  };
  return labels[event] ?? event;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function RecapClient({
  recap,
  athleteFirstName,
}: {
  recap: SessionRecap;
  athleteFirstName: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  // Show the PR splash once on mount if any PRs exist (and at least one is
  // not a first-time-at-this-weight — a "first attempt PR" isn't worth a splash).
  const celebratedPR = useMemo(
    () =>
      recap.personalRecords.find((pr) => !pr.isFirstAttempt) ?? recap.personalRecords[0] ?? null,
    [recap.personalRecords]
  );
  const [showSplash, setShowSplash] = useState(() => celebratedPR != null);

  // Wellness local state — seed from persisted value
  const [wellness, setWellness] = useState<Partial<Record<WellnessKey, WellnessValue>>>(() => {
    if (!recap.wellnessCheckin) return {};
    return {
      legs: recap.wellnessCheckin.legs,
      energy: recap.wellnessCheckin.energy,
      focus: recap.wellnessCheckin.focus,
    };
  });
  const [wellnessSaved, setWellnessSaved] = useState(recap.wellnessCheckin != null);
  const [wellnessSaving, setWellnessSaving] = useState(false);
  const [wellnessError, setWellnessError] = useState<string | null>(null);

  // Notify-coach state
  const [coachNotified, setCoachNotified] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  // Share state
  const [shareCopied, setShareCopied] = useState(false);

  // Keyboard shortcut: Escape closes splash (PRCelebration already handles click-to-dismiss)
  useEffect(() => {
    if (!showSplash) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSplash(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSplash]);

  const allWellnessAnswered =
    wellness.legs != null && wellness.energy != null && wellness.focus != null;

  async function saveWellness() {
    if (!allWellnessAnswered || wellnessSaving) return;
    setWellnessSaving(true);
    setWellnessError(null);
    try {
      const res = await fetch(`/api/athlete/session-recap/${recap.session.id}/wellness`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({
          legs: wellness.legs,
          energy: wellness.energy,
          focus: wellness.focus,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setWellnessError(data.error ?? "Could not save check-in.");
        return;
      }
      setWellnessSaved(true);
    } catch {
      setWellnessError("Network error. Please try again.");
    } finally {
      setWellnessSaving(false);
    }
  }

  async function notifyCoach() {
    if (coachNotified || notifying) return;
    setNotifying(true);
    setNotifyError(null);
    try {
      const res = await fetch(`/api/athlete/session-recap/${recap.session.id}/notify-coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotifyError(data.error ?? "Could not send.");
        return;
      }
      setCoachNotified(true);
    } catch {
      setNotifyError("Network error. Please try again.");
    } finally {
      setNotifying(false);
    }
  }

  async function shareTopThrow() {
    if (!recap.topThrow) return;
    const text = recap.topThrow.shareText;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ text, title: "My top throw" });
        return;
      }
    } catch (err) {
      // Fall through to clipboard
      logger.debug("Fall through to clipboard", {
        context: "src/app/(dashboard)/athlete/sessions/[id]/recap/_recap-client.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      // ignore
      logger.debug("ignore", {
        context: "src/app/(dashboard)/athlete/sessions/[id]/recap/_recap-client.tsx",
        metadata: { reason: err instanceof Error ? err.message : "unknown" },
      });
    }
  }

  // Framer variants — reduced motion uses identity variants so elements land in
  // their final state without animating. Typed as Variants to satisfy TS.
  const sectionVariants: Variants = prefersReducedMotion
    ? {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0 },
      }
    : {
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0 },
      };

  const containerVariants: Variants = prefersReducedMotion
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.08, delayChildren: celebratedPR ? 0.5 : 0 },
        },
      };

  const completedAt = recap.session.completedDate ?? recap.session.scheduledDate;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* PR Splash */}
      {celebratedPR && (
        <PRCelebration
          show={showSplash}
          onDismiss={() => setShowSplash(false)}
          event={celebratedPR.event}
          distance={celebratedPR.newDistance}
        />
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-24 space-y-6"
      >
        {/* Header row */}
        <motion.div variants={sectionVariants} className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Session Complete
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-heading font-bold">
              Nice work, {athleteFirstName}.
            </h1>
            <p className="mt-1 text-sm text-muted">
              {formatDate(completedAt)} · {formatTime(completedAt)}
            </p>
          </div>
          <Link
            href="/athlete/dashboard"
            aria-label="Exit recap"
            className="btn btn-ghost h-10 w-10 p-0 flex items-center justify-center rounded-full"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </motion.div>

        {/* Hero stats */}
        <motion.div variants={sectionVariants} className="card p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <HeroStat label="Throws" value={recap.summary.totalThrows} decimals={0} />
            <HeroStat
              label="Best"
              value={recap.summary.bestThrow?.distance ?? 0}
              decimals={2}
              suffix="m"
              emphasized={recap.summary.bestThrow?.isPersonalBest}
            />
            <HeroStat
              label="Average"
              value={recap.summary.averageDistance ?? 0}
              decimals={2}
              suffix="m"
              muted={recap.summary.averageDistance == null}
            />
            <HeroStat label="Implements" value={recap.summary.implementsUsed.length} decimals={0} />
          </div>
          {recap.summary.implementsUsed.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex flex-wrap gap-2">
              {recap.summary.implementsUsed.map((imp) => (
                <span
                  key={`${imp.event}:${imp.weightKg}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-surface-100 dark:bg-surface-800/60 text-[var(--foreground)] px-2.5 py-1 rounded-full border border-[var(--card-border)]"
                >
                  <Target className="h-3 w-3 text-muted" strokeWidth={1.75} aria-hidden="true" />
                  <span className="font-mono tabular-nums">{imp.weightKg}kg</span>
                  <span className="text-muted">·</span>
                  <span>{formatEventLabel(imp.event)}</span>
                  <span className="text-muted font-mono tabular-nums">×{imp.count}</span>
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {/* Personal records */}
        {recap.personalRecords.length > 0 && (
          <motion.div variants={sectionVariants} className="space-y-3">
            {recap.personalRecords.map((pr) => (
              <PRCard key={pr.throwLogId} pr={pr} />
            ))}
          </motion.div>
        )}

        {/* Last session comparison */}
        {recap.lastSessionComparison && (
          <motion.div variants={sectionVariants} className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              vs. Last Session
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <ComparisonStat
                label="Throws"
                delta={recap.lastSessionComparison.throwCountDelta}
                decimals={0}
                unit=""
              />
              <ComparisonStat
                label="Avg Distance"
                delta={recap.lastSessionComparison.averageDistanceDelta}
                decimals={2}
                unit="m"
              />
            </div>
            {recap.lastSessionComparison.previousSessionDate && (
              <p className="mt-3 text-xs text-muted">
                Compared to {formatDate(recap.lastSessionComparison.previousSessionDate)}
              </p>
            )}
          </motion.div>
        )}

        {/* Streak */}
        {recap.streak.current > 0 && (
          <motion.div variants={sectionVariants} className="card p-5 flex items-center gap-4">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center bg-amber-500/10"
              aria-hidden="true"
            >
              <Flame className="h-6 w-6 text-amber-500" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Training Streak
              </p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">
                <AnimatedNumber value={recap.streak.current} decimals={0} />
                <span className="ml-1 text-sm font-normal text-muted">
                  day{recap.streak.current === 1 ? "" : "s"}
                </span>
              </p>
            </div>
            {recap.streak.current === recap.streak.longest && recap.streak.current > 1 && (
              <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                Longest ever
              </span>
            )}
          </motion.div>
        )}

        {/* Top throw */}
        {recap.topThrow && (
          <motion.div variants={sectionVariants} className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
              <Trophy
                className="h-3.5 w-3.5 text-amber-500"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              Top Throw
            </h2>
            <div className="flex items-baseline gap-3">
              <p className="text-4xl font-bold font-mono tabular-nums text-[var(--foreground)]">
                <AnimatedNumber value={recap.topThrow.distance} decimals={2} />
                <span className="text-lg text-muted font-normal">m</span>
              </p>
              {recap.topThrow.rpe != null && (
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  RPE {recap.topThrow.rpe.toFixed(1)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatEventLabel(recap.topThrow.event)} ·{" "}
              <span className="font-mono tabular-nums">{recap.topThrow.implementWeight}kg</span>
            </p>
            <button
              type="button"
              onClick={shareTopThrow}
              className="btn btn-secondary mt-4 inline-flex items-center gap-2"
              aria-label="Share top throw"
            >
              {shareCopied ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Share
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Wellness check-in */}
        <motion.div variants={sectionVariants} className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              How do you feel?
            </h2>
            {wellnessSaved && (
              <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Saved
              </span>
            )}
          </div>
          <p className="text-xs text-muted mb-4">Optional — helps your coach plan recovery.</p>

          <div className="space-y-3">
            {WELLNESS_QUESTIONS.map((q) => (
              <div key={q.key} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[var(--foreground)] w-16 shrink-0">
                  {q.prompt}
                </span>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  {WELLNESS_OPTIONS.map((opt) => {
                    const active = wellness[q.key] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setWellness((prev) => ({ ...prev, [q.key]: opt.value }))}
                        disabled={wellnessSaved && !wellnessSaving}
                        aria-label={`${q.prompt}: ${opt.label}`}
                        aria-pressed={active}
                        className={`rounded-lg px-2 py-2.5 flex items-center justify-center gap-1.5 text-sm border transition-all ${
                          active
                            ? "border-primary-500 bg-primary-500/10 text-[var(--foreground)] shadow-sm"
                            : "border-[var(--card-border)] bg-surface-50 dark:bg-surface-900/50 text-muted hover:text-[var(--foreground)] active:scale-[0.97]"
                        }`}
                      >
                        <span aria-hidden="true" className="text-lg leading-none">
                          {opt.emoji}
                        </span>
                        <span className="hidden sm:inline text-xs font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {wellnessError && <p className="mt-3 text-xs text-red-500">{wellnessError}</p>}

          {!wellnessSaved && (
            <button
              type="button"
              onClick={saveWellness}
              disabled={!allWellnessAnswered || wellnessSaving}
              className="btn btn-primary mt-4 w-full sm:w-auto"
            >
              {wellnessSaving ? "Saving…" : "Save check-in"}
            </button>
          )}
        </motion.div>

        {/* Footer CTAs */}
        <motion.div variants={sectionVariants} className="space-y-3 pt-2">
          <button
            type="button"
            onClick={notifyCoach}
            disabled={coachNotified || notifying}
            className="btn btn-primary w-full inline-flex items-center justify-center gap-2"
          >
            {coachNotified ? (
              <>
                <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Sent to coach
              </>
            ) : notifying ? (
              "Sending…"
            ) : (
              <>
                <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Send to coach
              </>
            )}
          </button>
          {notifyError && <p className="text-xs text-red-500">{notifyError}</p>}
          <Link
            href="/athlete/dashboard"
            className="btn btn-secondary w-full inline-flex items-center justify-center"
          >
            Back to dashboard
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function HeroStat({
  label,
  value,
  decimals,
  suffix,
  emphasized,
  muted,
}: {
  label: string;
  value: number;
  decimals: number;
  suffix?: string;
  emphasized?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
          emphasized ? "text-amber-500" : muted ? "text-muted" : "text-[var(--foreground)]"
        }`}
      >
        {muted && value === 0 ? (
          "—"
        ) : (
          <>
            <AnimatedNumber value={value} decimals={decimals} />
            {suffix && <span className="text-base font-normal text-muted">{suffix}</span>}
          </>
        )}
      </p>
    </div>
  );
}

function PRCard({ pr }: { pr: SessionRecap["personalRecords"][number] }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative overflow-hidden rounded-2xl p-5 border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent"
      >
        {/* Corner glow */}
        <div
          className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-500/20 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-500">
              New Personal Best
            </p>
          </div>

          <p className="mt-2 text-4xl sm:text-5xl font-bold font-mono tabular-nums text-[var(--foreground)]">
            <AnimatedNumber value={pr.newDistance} decimals={2} />
            <span className="text-xl text-muted font-normal">m</span>
          </p>

          <p className="mt-1 text-sm text-[var(--foreground)]">
            {formatEventLabel(pr.event)} ·{" "}
            <span className="font-mono tabular-nums text-muted">{pr.implementWeight}kg</span>
          </p>

          {pr.isFirstAttempt ? (
            <p className="mt-3 text-xs font-medium text-muted">First attempt at this weight</p>
          ) : pr.previousDistance != null && pr.delta != null ? (
            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <span className="text-xs text-muted">Previous:</span>
              <span className="text-sm font-mono tabular-nums line-through text-muted decoration-red-500/70 decoration-[1.5px]">
                {pr.previousDistance.toFixed(2)}m
              </span>
              <span className="text-xs font-bold text-emerald-500 font-mono tabular-nums">
                +{pr.delta.toFixed(2)}m
              </span>
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ComparisonStat({
  label,
  delta,
  decimals,
  unit,
}: {
  label: string;
  delta: number | null;
  decimals: number;
  unit: string;
}) {
  const isPositive = delta != null && delta > 0;
  const isNegative = delta != null && delta < 0;
  const isNeutral = delta == null || delta === 0;

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const colorClass = isPositive ? "text-emerald-500" : isNegative ? "text-red-500" : "text-muted";

  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-bold font-mono tabular-nums flex items-center gap-1.5 ${colorClass}`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        {delta == null ? (
          "—"
        ) : (
          <>
            {isPositive ? "+" : ""}
            {delta.toFixed(decimals)}
            {unit}
          </>
        )}
      </p>
      {isNeutral && delta === 0 && <p className="text-xs text-muted mt-0.5">No change</p>}
    </div>
  );
}
