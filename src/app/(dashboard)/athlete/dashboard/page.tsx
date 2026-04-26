import Link from "next/link";
import { ArrowRight, Sparkles, Trophy } from "lucide-react";
import { requireAthleteSession, getAthleteStats } from "@/lib/data/athlete";
import { fetchUpcomingThrowsAssignments } from "@/lib/data/throws-hub";
import prisma from "@/lib/prisma";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { StaleSessionChecker } from "./_stale-session-checker";
import { StreakReminder } from "@/components/notifications/StreakReminder";
import { StreakHaptic } from "./_streak-haptic";
import { StreakBlock } from "./_streak-block";
import { StreakCelebrationGate } from "./_streak-celebration";
import { PwaVisitTracker } from "@/components/pwa/PwaVisitTracker";
import { RecapSheet } from "./_recap-sheet";
import { getStreakState } from "@/lib/athlete/streak-engine";

/* ─── Athlete Home — canonical consumer-app shell ────────────────────────────
   ONE hero anchor in the thumb zone, state-aware:
     A. Haven't checked in today → "How are you today?" leads to wellness.
     B. Checked in, no throws logged → "Ready to train" + log CTA.
     C. Threw today → recap of today's best.

   Below the hero: a 7-day streak strip and the most recent personal best.
   No tabs. No widget grid. No customization panel. The athlete should
   never have to configure their own home.

   Wearables and deeper health data live at /athlete/wellness —
   home is not a dashboard, it's a decision.
   ─────────────────────────────────────────────────────────────────────── */

const EVENT_LABEL: Record<string, string> = {
  SHOT_PUT: "Shot put",
  DISCUS: "Discus",
  HAMMER: "Hammer",
  JAVELIN: "Javelin",
};

const EVENT_COLOR: Record<string, string> = {
  SHOT_PUT: "#ff8a3d",
  DISCUS: "#8b5cf6",
  HAMMER: "#ef4444",
  JAVELIN: "#22c55e",
};

function timeGreeting(hour: number, firstName: string) {
  if (hour < 5) return `Late night, ${firstName}`;
  if (hour < 12) return `Morning, ${firstName}`;
  if (hour < 17) return `Afternoon, ${firstName}`;
  if (hour < 21) return `Evening, ${firstName}`;
  return `Evening, ${firstName}`;
}

function formatReadinessLabel(score: number) {
  if (score >= 8) return "Ready";
  if (score >= 6) return "Steady";
  if (score >= 4) return "Cautious";
  return "Recover";
}

function readinessColor(score: number) {
  if (score >= 8) return "var(--color-status-success-fg)";
  if (score >= 6) return "var(--color-brand)";
  if (score >= 4) return "var(--color-status-warning-fg)";
  return "var(--color-status-danger-fg)";
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default async function AthleteDashboardPage() {
  const { athlete } = await requireAthleteSession();

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfStrip = new Date(startOfToday);
  startOfStrip.setDate(startOfToday.getDate() - 6);

  const [stats, todayThrows, streakWindow, notifPrefs, upcomingAssignments, streakState] =
    await Promise.all([
      getAthleteStats(athlete.id),
      prisma.throwLog.findMany({
        where: { athleteId: athlete.id, date: { gte: startOfToday } },
        select: { distance: true, event: true, implementWeight: true },
        orderBy: { distance: "desc" },
      }),
      // Last 7 days of session activity for the streak strip
      prisma.trainingSession.findMany({
        where: {
          athleteId: athlete.id,
          status: "COMPLETED",
          completedDate: { gte: startOfStrip },
        },
        select: { completedDate: true },
      }),
      prisma.athleteProfile.findUnique({
        where: { id: athlete.id },
        select: { notificationPreferences: true },
      }),
      fetchUpcomingThrowsAssignments(athlete.id),
      getStreakState(athlete.id),
    ]);

  // Today's coach-assigned throws session, if any. Only treat ASSIGNED or
  // IN_PROGRESS as actionable — completed sessions take the threwToday path.
  const todayYMD = startOfToday.toISOString().slice(0, 10);
  const todayAssignment =
    upcomingAssignments.find(
      (a) =>
        a.scheduledDate.slice(0, 10) === todayYMD &&
        (a.status === "ASSIGNED" || a.status === "IN_PROGRESS")
    ) ?? null;

  // Readiness logged today?
  const readiness = stats.latestReadiness;
  const readinessIsToday = readiness !== null && sameDay(new Date(readiness.date), now);

  // Any throws today? Picks the heaviest-distance throw as the day's "best."
  const bestToday = todayThrows[0] ?? null;
  const threwToday = bestToday !== null;

  // 7-day streak strip — one dot per day
  const activeDays = new Set<string>();
  for (const s of streakWindow) {
    if (!s.completedDate) continue;
    const d = new Date(s.completedDate);
    d.setHours(0, 0, 0, 0);
    activeDays.add(d.toISOString().slice(0, 10));
  }
  const stripDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfStrip);
    d.setDate(startOfStrip.getDate() + i);
    return {
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { weekday: "short" })[0],
      active: activeDays.has(d.toISOString().slice(0, 10)),
      isToday: sameDay(d, now),
    };
  });

  // Most recent PR (across events)
  const latestPR =
    [...stats.personalBests].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0] ?? null;

  // Notif preference plumbing for StreakReminder
  const streakReminderPrefs = (() => {
    const raw = notifPrefs?.notificationPreferences as
      | { streakReminder?: { enabled?: unknown; promptDismissed?: unknown } }
      | null
      | undefined;
    const s = raw?.streakReminder;
    return {
      enabled: s?.enabled === true,
      promptDismissed: s?.promptDismissed === true,
    };
  })();

  const greeting = timeGreeting(now.getHours(), athlete.firstName);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <StaleSessionChecker />
      <PwaVisitTracker />
      <RecapSheet />
      <StreakHaptic streak={stats.currentStreak} />
      <StreakCelebrationGate currentStreak={stats.currentStreak} />
      <StreakReminder
        currentStreak={stats.currentStreak}
        initialEnabled={streakReminderPrefs.enabled}
        initialPromptDismissed={streakReminderPrefs.promptDismissed}
      />
      {streakState && (streakState.isInRebuild || streakState.currentStreak > 0) && (
        <StreakBlock
          currentStreak={streakState.currentStreak}
          longestStreak={streakState.longestStreak}
          freezesAvailable={streakState.freezesAvailable}
          todayCovered={streakState.todayCovered}
          isInRebuild={streakState.isInRebuild}
          lastBrokenStreakDays={streakState.lastBrokenStreakDays}
        />
      )}

      {/* Greeting — warm, personal, restrained. No emoji, no gradient. */}
      <header className="pt-1">
        <h1 className="font-heading text-[28px] leading-[1.05] font-semibold text-[var(--color-text-primary)]">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      {/* HERO — state-aware single anchor. One primary action, nothing else. */}
      {threwToday ? (
        <TodayRecapHero
          distance={bestToday.distance}
          event={bestToday.event}
          implementKg={bestToday.implementWeight}
          throwCount={todayThrows.length}
        />
      ) : readinessIsToday ? (
        <ReadyToTrainHero readinessScore={readiness.overallScore} assignment={todayAssignment} />
      ) : (
        <CheckInHero firstName={athlete.firstName} />
      )}

      {/* Streak strip — 7 days at a glance, lightweight */}
      <section aria-labelledby="week-heading" className="pt-1">
        <div className="flex items-baseline justify-between mb-3">
          <h2
            id="week-heading"
            className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]"
          >
            This week
          </h2>
        </div>

        <ol className="flex items-end justify-between gap-1">
          {stripDays.map((d) => (
            <li
              key={d.key}
              className="flex-1 flex flex-col items-center gap-2"
              aria-label={`${d.label}${d.active ? ", trained" : ""}${d.isToday ? ", today" : ""}`}
            >
              <span
                className={
                  d.active
                    ? "w-7 h-7 rounded-full bg-[var(--color-brand)]"
                    : d.isToday
                      ? "w-7 h-7 rounded-full border-2 border-dashed border-[var(--color-border-strong)]"
                      : "w-7 h-7 rounded-full bg-[var(--color-bg-surface-sunken)] border border-[var(--color-border-default)]"
                }
                aria-hidden="true"
              />
              <span
                className={
                  d.isToday
                    ? "text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-primary)]"
                    : "text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]"
                }
              >
                {d.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Latest PR — single, confident, big number. No grid of stats. */}
      {latestPR && latestPR.distance !== null && (
        <LatestPRCard distance={latestPR.distance} event={latestPR.event} date={latestPR.date} />
      )}

      {/* Tail — the only secondary link. Kept quiet. */}
      <div className="pt-1 pb-1">
        <Link
          href="/athlete/throws/trends"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          See all trends
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Hero variants ──────────────────────────────────────────────────────── */

/**
 * State A: No readiness logged today. Coach wants this daily. We ask
 * softly — no red alarm. Warmth over nag.
 */
function CheckInHero({ firstName }: { firstName: string }) {
  return (
    <Link
      href="/athlete/wellness"
      className="group block rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] p-5 transition-[transform,border-color] duration-150 active:scale-[0.995] hover:border-[var(--color-border-strong)]"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-[var(--color-brand-subtle)] flex items-center justify-center shrink-0">
          <Sparkles
            size={20}
            strokeWidth={1.75}
            style={{ color: "var(--color-brand)" }}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-xl font-semibold text-[var(--color-text-primary)]">
            How are you today, {firstName}?
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            A quick check-in — sleep, soreness, energy. Takes 30 seconds.
          </p>
        </div>
        <ArrowRight
          size={20}
          strokeWidth={1.75}
          className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors shrink-0 mt-1"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

/**
 * State B: Ready to go. Bold amber anchor — the whole page is for this.
 * No gradient, no glow. Opaque fill, confident shadow.
 *
 * If a coach has assigned a session for today, the hero specializes:
 * the title becomes the plan name, the CTA routes to that assignment,
 * and IN_PROGRESS sessions resume in the live player. Without an
 * assignment, the hero opens the generic log wizard. Same anchor,
 * smarter destination.
 */
function ReadyToTrainHero({
  readinessScore,
  assignment,
}: {
  readinessScore: number;
  assignment: { id: string; planName: string | null; status: string } | null;
}) {
  const label = formatReadinessLabel(readinessScore);
  const color = readinessColor(readinessScore);

  const isInProgress = assignment?.status === "IN_PROGRESS";
  const href = assignment
    ? isInProgress
      ? `/athlete/throws/${assignment.id}?view=live`
      : `/athlete/throws/${assignment.id}`
    : "/athlete/log-session";

  const title =
    assignment?.planName?.trim() || (assignment ? "Today’s session" : "Log today’s session");
  const description = assignment
    ? isInProgress
      ? "You started this session — pick up where you left off."
      : "Coach assigned this for today. Tap to begin."
    : "Open the wizard — events, implements, throws, notes.";
  const eyebrow = assignment
    ? `Today’s session · readiness ${readinessScore}/10`
    : `${label} · readiness ${readinessScore}/10`;
  const ctaLabel = isInProgress ? "Resume" : "Start";

  return (
    <Link
      href={href}
      className="group block rounded-2xl bg-[var(--color-brand)] text-[var(--color-text-on-brand)] p-6 shadow-[0_8px_24px_-8px_rgba(255,200,0,0.3)] transition-transform duration-150 active:scale-[0.98]"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {eyebrow}
      </div>
      <h2 className="mt-2 font-heading text-[30px] leading-[1.05] font-bold line-clamp-2">
        {title}
      </h2>
      <p className="mt-1.5 text-sm opacity-80">{description}</p>
      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
        {ctaLabel}
        <ArrowRight
          size={18}
          strokeWidth={2.25}
          aria-hidden="true"
          className="transition-transform duration-150 group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}

/**
 * State C: Trained today. Confident acknowledgment, not confetti.
 * One big number — the day's best distance. Everything else is context.
 */
function TodayRecapHero({
  distance,
  event,
  implementKg,
  throwCount,
}: {
  distance: number | null;
  event: string;
  implementKg: number;
  throwCount: number;
}) {
  const eventLabel = EVENT_LABEL[event] ?? event;
  const eventColor = EVENT_COLOR[event] ?? "var(--color-brand)";

  return (
    <div className="rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] p-6">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: eventColor }}
          aria-hidden="true"
        />
        {eventLabel} · {implementKg}kg · today
      </div>

      {distance !== null ? (
        <div className="mt-2">
          <div className="flex items-baseline gap-1.5">
            <AnimatedNumber
              value={distance}
              decimals={2}
              className="font-heading font-bold text-[56px] leading-none tabular-nums text-[var(--color-text-primary)]"
              duration={900}
            />
            <span className="text-2xl font-semibold text-[var(--color-text-secondary)]">m</span>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Best of {throwCount} {throwCount === 1 ? "throw" : "throws"} today.
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <p className="font-heading text-2xl font-semibold text-[var(--color-text-primary)]">
            {throwCount} {throwCount === 1 ? "throw" : "throws"} logged
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            No distances recorded for this session.
          </p>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Link
          href="/athlete/throws/history"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand-strong)] hover:underline"
        >
          Review session
          <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
        </Link>
        <span className="text-[var(--color-border-strong)]">·</span>
        <Link
          href="/athlete/log-session"
          className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Log another
        </Link>
      </div>
    </div>
  );
}

/* ─── PR Card ────────────────────────────────────────────────────────────── */

function LatestPRCard({
  distance,
  event,
  date,
}: {
  distance: number;
  event: string;
  date: string;
}) {
  const eventLabel = EVENT_LABEL[event] ?? event;
  const daysAgo = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
  const dateLabel =
    daysAgo === 0
      ? "Today"
      : daysAgo === 1
        ? "Yesterday"
        : daysAgo < 7
          ? `${daysAgo} days ago`
          : new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Link
      href="/athlete/throws/trends"
      className="group flex items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] p-5 transition-[transform,border-color] duration-150 active:scale-[0.995] hover:border-[var(--color-border-strong)]"
    >
      <div className="w-11 h-11 rounded-full bg-[var(--color-brand-subtle)] flex items-center justify-center shrink-0">
        <Trophy
          size={20}
          strokeWidth={1.75}
          style={{ color: "var(--color-brand)" }}
          aria-hidden="true"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          Latest PR · {eventLabel}
        </p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="font-heading text-[26px] leading-none font-bold tabular-nums text-[var(--color-text-primary)]">
            {distance.toFixed(2)}
          </span>
          <span className="text-base font-semibold text-[var(--color-text-secondary)]">m</span>
        </p>
      </div>
      <p className="text-xs font-medium text-[var(--color-text-secondary)] shrink-0">{dateLabel}</p>
    </Link>
  );
}
