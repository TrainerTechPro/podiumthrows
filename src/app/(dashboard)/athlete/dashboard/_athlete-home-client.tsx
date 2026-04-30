"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Trophy, CheckCircle2, Flame, Play, ChevronRight } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { PerformanceTestsTile } from "@/components/performance-tests/PerformanceTestsTile";
import type {
  AthleteDashboardDTO,
  PrescriptionToken,
  TodayCardDTO,
  WeekStripDTO,
  WeekDayDTO,
  LastPRDTO,
  LastSessionDTO,
} from "@/lib/athlete/dashboard-data";

interface Props {
  initial: AthleteDashboardDTO;
  hour: number;
  athleteId: string;
}

const EVENT_LABEL: Record<string, string> = {
  SHOT_PUT: "Shot put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

/**
 * Athlete Home — the front door, the screen the athlete opens 30 times a day.
 *
 * Server component fetches the DTO each request (force-dynamic). Pull-to-refresh
 * lives in the AthleteShell wrapper and triggers router.refresh(); we re-key the
 * subtree on the DTO timestamp so entrance animations replay after a refresh.
 */
export function AthleteHomeClient({ initial, hour, athleteId }: Props) {
  const greeting = useMemo(() => timeGreeting(hour), [hour]);

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100dvh-3.5rem)] sm:-mx-6">
      <Hero
        athlete={initial.athlete}
        greeting={greeting}
        readiness={initial.readiness}
        today={initial.today}
      />
      {initial.today ? (
        <TodayHeroCard today={initial.today} />
      ) : (
        <RestDayCard firstName={initial.athlete.firstName} />
      )}
      <SectionHeader label="This week" trailingHref="/athlete/sessions" trailingLabel="See plan" />
      <WeekStrip strip={initial.week} />
      <SectionHeader label="Performance" />
      <div className="px-4 sm:px-6">
        <PerformanceTestsTile athleteId={athleteId} />
      </div>
      <SectionHeader
        label="Recent"
        trailingHref="/athlete/throws/trends"
        trailingLabel="All trends"
      />
      <RecentMoments recent={initial.recent} />
      <div className="h-12" />
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

function Hero({
  athlete,
  greeting,
  readiness,
  today,
}: {
  athlete: AthleteDashboardDTO["athlete"];
  greeting: string;
  readiness: AthleteDashboardDTO["readiness"];
  today: TodayCardDTO | null;
}) {
  return (
    <section className="px-6 pb-2 pt-2">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-heading text-[26px] font-semibold leading-[1.15] tracking-[-0.012em] text-[var(--foreground)]">
          {greeting}, <span className="text-[var(--muted)]">{athlete.firstName}.</span>
        </h1>
        <ReadinessRing readiness={readiness} />
      </div>
      <p className="mt-3 text-[14.5px] leading-[1.55] text-[var(--muted)]">
        {today ? (
          renderPrescription(today.prescription)
        ) : (
          <>No session today. Recovery and listen to your body.</>
        )}
      </p>
    </section>
  );
}

function renderPrescription(tokens: PrescriptionToken[]) {
  return (
    <>
      {tokens.map((tok, i) =>
        tok.kind === "implement" ? (
          <span
            key={i}
            className="mx-0.5 inline-block rounded-md border border-[var(--card-border)] bg-white/[0.03] px-1.5 py-px font-mono text-[12.5px] font-medium text-[var(--foreground)]"
          >
            {tok.value}
          </span>
        ) : (
          <span key={i}>{tok.value}</span>
        )
      )}
    </>
  );
}

// ── Readiness ring ──────────────────────────────────────────────────────────

function ReadinessRing({ readiness }: { readiness: AthleteDashboardDTO["readiness"] }) {
  const score = readiness?.score ?? 0;
  const circumference = 2 * Math.PI * 22; // r=22
  const targetOffset = circumference - (score / 5) * circumference;
  const [offset, setOffset] = useState(circumference);
  const id = useRef(`ring-grad-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        setOffset(targetOffset);
        return;
      }
    }
    // Tiny rAF chain so the browser commits the initial state before the
    // transition begins — guarantees the arc animates from empty to target.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOffset(targetOffset));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [targetOffset]);

  const ariaLabel = readiness
    ? `Readiness ${readiness.score} of 5${readiness.source !== "self" ? ` from ${readiness.source}` : ""}. Tap to update.`
    : "No readiness on file. Tap to check in.";

  return (
    <Link
      href="/athlete/wellness"
      aria-label={ariaLabel}
      className="relative inline-grid h-14 w-14 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
    >
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <defs>
          <linearGradient id={id.current} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00FF88" />
            <stop offset="100%" stopColor="#FFC800" />
          </linearGradient>
        </defs>
        <circle
          cx="28"
          cy="28"
          r="22"
          strokeWidth={5}
          fill="none"
          className="stroke-[var(--card-border)]"
        />
        <circle
          cx="28"
          cy="28"
          r="22"
          strokeWidth={5}
          fill="none"
          stroke={`url(#${id.current})`}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 28 28)"
          style={{ transition: "stroke-dashoffset 600ms ease-out" }}
        />
      </svg>
      <span className="absolute font-mono text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
        {readiness?.score ?? "—"}
      </span>
    </Link>
  );
}

// ── Today hero card ─────────────────────────────────────────────────────────

function TodayHeroCard({ today }: { today: TodayCardDTO }) {
  const status = today.status;
  return (
    <section
      className="relative mx-4 mt-2 overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] motion-safe:animate-fade-slide-in"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,200,0,0.04), transparent 60%), var(--card-bg)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/45 to-transparent"
        aria-hidden="true"
      />

      <div className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] ${
              status === "LOGGED" ? "text-success-500" : "text-primary-500"
            }`}
          >
            {status === "PRESCRIBED" ? (
              <span
                className="relative inline-block h-1.5 w-1.5 rounded-full bg-primary-500 motion-safe:animate-pulse"
                style={{ boxShadow: "0 0 10px rgba(255,200,0,0.5)" }}
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            )}
            Today ·{" "}
            {status === "LOGGED"
              ? "LOGGED"
              : status === "IN_PROGRESS"
                ? "IN PROGRESS"
                : "PRESCRIBED"}
          </span>
          <span className="font-mono text-[10px] font-medium tracking-[0.06em] text-[var(--muted)]">
            {today.durationLabel}
          </span>
        </div>

        <Link
          href={`/athlete/sessions/${today.sessionId}`}
          className="mt-3 block focus-visible:outline-none"
        >
          <h2 className="font-heading text-[26px] font-semibold leading-[1.18] tracking-[-0.01em] text-[var(--foreground)]">
            {today.title}
          </h2>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-1.5 px-5 pt-4">
        {today.blocks.map((b) => (
          <div
            key={b.label}
            className={`flex flex-col gap-0.5 rounded-xl border px-2.5 py-2 ${
              b.isHeavy
                ? "border-primary-500/30 bg-primary-500/5"
                : "border-[var(--card-border)] bg-surface-50 dark:bg-surface-900/60"
            }`}
          >
            <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {b.label}
            </span>
            <span
              className={`font-mono text-[11px] font-semibold tabular-nums ${
                b.isHeavy ? "text-primary-500" : "text-[var(--foreground)]"
              }`}
            >
              {b.value}
            </span>
          </div>
        ))}
        {/* Pad the row when fewer than 4 blocks so widths stay equal. */}
        {Array.from({ length: Math.max(0, 4 - today.blocks.length) }).map((_, i) => (
          <div
            key={`pad-${i}`}
            className="flex flex-col gap-0.5 rounded-xl border border-dashed border-[var(--card-border)] px-2.5 py-2 opacity-40"
          >
            <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted)]">
              —
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">—</span>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5 pt-4">
        <Link
          href={`/athlete/sessions/${today.sessionId}`}
          className="grid h-14 w-full place-items-center rounded-2xl bg-primary-500 text-surface-950 font-heading text-[16px] font-bold tracking-[0.005em] shadow-[0_8px_24px_-8px_rgba(255,200,0,0.45)] transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60"
        >
          <span className="inline-flex items-center gap-2">
            <Play
              className="h-[18px] w-[18px]"
              strokeWidth={2.5}
              fill="currentColor"
              aria-hidden="true"
            />
            {status === "LOGGED"
              ? "Review session"
              : status === "IN_PROGRESS"
                ? "Resume session"
                : "Start session"}
          </span>
        </Link>
      </div>
    </section>
  );
}

function RestDayCard({ firstName }: { firstName: string }) {
  return (
    <section className="mx-4 mt-2 overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] motion-safe:animate-fade-slide-in">
      <div className="px-5 py-6">
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          Rest day
        </div>
        <h2 className="mt-2 font-heading text-[22px] font-semibold leading-[1.2] tracking-[-0.005em] text-[var(--foreground)]">
          No session today, {firstName}.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Recovery is part of the program. Mobility, sleep, and nutrition.
        </p>
        <Link
          href="/athlete/log-session"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-[var(--card-border)] bg-surface-50 px-5 text-[14px] font-medium text-[var(--foreground)] transition-colors hover:bg-surface-100 dark:bg-surface-900 dark:hover:bg-surface-800"
        >
          Log something
        </Link>
      </div>
    </section>
  );
}

// ── Section header ──────────────────────────────────────────────────────────

function SectionHeader({
  label,
  trailingHref,
  trailingLabel,
}: {
  label: string;
  trailingHref?: string;
  trailingLabel?: string;
}) {
  const showTrail = trailingHref && trailingLabel;
  return (
    <div className="mt-7 flex items-center justify-between px-5 pb-3">
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </h3>
      {showTrail && (
        <Link
          href={trailingHref}
          className="inline-flex items-center gap-0.5 font-mono text-[11px] tracking-[0.04em] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          {trailingLabel}
          <ChevronRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

// ── Week strip ──────────────────────────────────────────────────────────────

function WeekStrip({ strip }: { strip: WeekStripDTO }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 px-4">
      {strip.days.map((d) => (
        <DayCard key={d.date} day={d} />
      ))}
    </div>
  );
}

function DayCard({ day }: { day: WeekDayDTO }) {
  const isToday = day.state === "today";
  const isDone = day.state === "done";
  const isFuture = day.state === "future";
  const baseClass = isToday
    ? "border-transparent bg-primary-500 text-surface-950 shadow-[0_0_18px_rgba(255,200,0,0.35)]"
    : isDone
      ? "border-[var(--card-border)] bg-surface-50 text-[var(--foreground)] dark:bg-surface-900/60"
      : isFuture
        ? "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted)] opacity-60"
        : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)]";

  const Wrapper: React.ElementType = day.sessionId ? Link : "div";
  const wrapperProps = day.sessionId ? { href: `/athlete/sessions/${day.sessionId}` } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`flex aspect-[1/1.35] flex-col items-center justify-between rounded-xl border px-1.5 pb-2 pt-2.5 ${baseClass}`}
    >
      <span
        className={`font-mono text-[9px] font-medium tracking-[0.1em] ${
          isToday ? "text-surface-950/80" : "text-[var(--muted)]"
        }`}
      >
        {day.dow}
      </span>
      <span className="font-heading text-[16px] font-semibold leading-none">{day.dayNumber}</span>
      <DayDot state={day.state} />
    </Wrapper>
  );
}

function DayDot({ state }: { state: WeekDayDTO["state"] }) {
  if (state === "done") {
    return (
      <span
        className="h-[5px] w-[5px] rounded-full bg-success-500"
        style={{ boxShadow: "0 0 6px rgba(0,255,136,0.5)" }}
        aria-hidden="true"
      />
    );
  }
  if (state === "today") {
    return <span className="h-[5px] w-[5px] rounded-full bg-surface-950" aria-hidden="true" />;
  }
  if (state === "scheduled") {
    return <span className="h-[5px] w-[5px] rounded-full bg-[var(--muted)]" aria-hidden="true" />;
  }
  return (
    <span className="h-[5px] w-[5px] rounded-full bg-[var(--card-border)]" aria-hidden="true" />
  );
}

// ── Recent moments ──────────────────────────────────────────────────────────

function RecentMoments({ recent }: { recent: AthleteDashboardDTO["recent"] }) {
  const items = [];
  if (recent.lastPR) items.push(<PRRow key="pr" pr={recent.lastPR} />);
  if (recent.lastSession) items.push(<LastSessionRow key="ls" session={recent.lastSession} />);
  if (recent.currentStreak)
    items.push(
      <StreakRow
        key="streak"
        count={recent.currentStreak.count}
        longest={recent.currentStreak.longest}
      />
    );

  if (items.length === 0) {
    return (
      <div className="mx-4 rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-6 text-center">
        <p className="text-sm text-[var(--muted)]">Log a session and your moments show up here.</p>
      </div>
    );
  }

  return <div className="space-y-2.5 px-4">{items}</div>;
}

function PRRow({ pr }: { pr: LastPRDTO }) {
  const event = EVENT_LABEL[pr.event] ?? pr.event;
  const delta =
    pr.previousBest != null && pr.distance != null
      ? Math.round((pr.distance - pr.previousBest) * 100) / 100
      : null;
  const href = pr.competitionId
    ? `/athlete/competitions/${pr.competitionId}`
    : `/athlete/throws/trends`;
  return (
    <MomentRow
      href={href}
      tone="brand"
      icon={<Trophy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
      head={`NEW PR · ${pr.daysAgoLabel}`}
      body={
        <>
          {event} ·{" "}
          <span className="font-mono font-semibold text-primary-500">
            <NumberFlow value={pr.distance} decimals={2} suffix="m" />
          </span>
          {pr.competitionName ? (
            <span className="text-[var(--muted)]"> at {pr.competitionName}</span>
          ) : null}
        </>
      }
      meta={delta != null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}M VS PREVIOUS` : null}
    />
  );
}

function LastSessionRow({ session }: { session: LastSessionDTO }) {
  const event = EVENT_LABEL[session.eventLabel] ?? session.eventLabel;
  const meta =
    session.averageRpe != null
      ? `RPE ${session.averageRpe} AVG · ${session.totalLogged} LOGGED`
      : `${session.totalLogged} LOGGED`;
  return (
    <MomentRow
      href={`/athlete/sessions/${session.sessionId}`}
      tone="success"
      icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
      head={`LAST SESSION · ${session.dowLabel}`}
      body={
        <>
          {event}
          {session.topDistance != null ? (
            <>
              {" · "}
              <span className="font-mono font-semibold text-[var(--foreground)]">
                <NumberFlow value={session.topDistance} decimals={2} suffix="m" />
              </span>
              <span className="text-[var(--muted)]"> top throw</span>
            </>
          ) : null}
        </>
      }
      meta={meta}
    />
  );
}

function StreakRow({ count, longest }: { count: number; longest: number }) {
  return (
    <MomentRow
      href="/athlete/throws/trends"
      tone="warning"
      icon={<Flame className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
      head="CURRENT STREAK"
      body={
        <>
          <span className="font-mono font-semibold text-[var(--foreground)]">
            <AnimatedNumber value={count} decimals={0} duration={1200} />
          </span>{" "}
          sessions logged
        </>
      }
      meta={longest > 0 ? `LONGEST: ${longest} · KEEP IT GOING` : "KEEP IT GOING"}
    />
  );
}

function MomentRow({
  href,
  tone,
  icon,
  head,
  body,
  meta,
}: {
  href: string;
  tone: "brand" | "success" | "warning";
  icon: React.ReactNode;
  head: string;
  body: React.ReactNode;
  meta: string | null;
}) {
  const iconClass =
    tone === "brand"
      ? "bg-primary-500/10 text-primary-500"
      : tone === "success"
        ? "bg-success-500/10 text-success-500"
        : "bg-warning-500/10 text-warning-500";
  return (
    <Link href={href} className="card card-interactive flex items-center gap-3 px-4 py-3.5">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconClass}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
          {head}
        </div>
        <div className="mt-0.5 truncate text-[14px] font-medium leading-[1.3] text-[var(--foreground)]">
          {body}
        </div>
        {meta ? (
          <div className="mt-0.5 truncate font-mono text-[10.5px] tracking-[0.04em] text-[var(--muted)]">
            {meta}
          </div>
        ) : null}
      </div>
      <ChevronRight
        className="h-[18px] w-[18px] shrink-0 text-[var(--muted)]"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </Link>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeGreeting(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Evening";
}
