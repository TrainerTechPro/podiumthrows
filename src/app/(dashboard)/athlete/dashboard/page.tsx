import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge, AnimatedNumber } from "@/components";
import { StreakBadge } from "@/components/ui/StreakBadge";
import {
  requireAthleteSession,
  getAthleteStats,
  getAthleteUpcomingSessions,
  getAthleteOnboardingGuide,
} from "@/lib/data/athlete";
import {
  getAthleteReadinessTrend,
  getAthleteRecentPRs,
} from "@/lib/data/coach";
import { WelcomeCard } from "./_welcome-card";
import { VolumeWidget } from "./_volume-widget";
import { ReadinessWidget } from "./_readiness-widget";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function formatScheduledDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ─── Stat Card ──────────────────────────────────────────────────────────── */

function StatCard({
  value,
  label,
  color = "text-[var(--foreground)]",
  sub,
}: {
  value: string | number;
  label: string;
  color?: string;
  sub?: string;
}) {
  const isNumeric = typeof value === "number";
  return (
    <div className="card px-5 py-4">
      <p className={cn("text-2xl font-bold tabular-nums font-heading", color)}>
        {isNumeric ? <AnimatedNumber value={value} /> : value}
      </p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-muted/70 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─── Session Card ───────────────────────────────────────────────────────── */

type UpcomingSession = {
  id: string;
  scheduledDate: string;
  status: string;
  planName: string | null;
  coachNotes: string | null;
};

function UpcomingSessionCard({ session }: { session: UpcomingSession }) {
  const isToday = formatScheduledDate(session.scheduledDate) === "Today";
  return (
    <Link
      href={`/athlete/sessions/${session.id}`}
      className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors group"
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold",
          isToday
            ? "bg-primary-500 text-white"
            : "bg-surface-100 dark:bg-surface-800 text-muted"
        )}
      >
        {new Date(session.scheduledDate).getDate()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)] truncate">
          {session.planName ?? "Training Session"}
        </p>
        <p className="text-xs text-muted truncate">
          {formatScheduledDate(session.scheduledDate)}
          {session.coachNotes && ` · ${session.coachNotes}`}
        </p>
      </div>
      {session.status === "IN_PROGRESS" && (
        <Badge variant="warning">In Progress</Badge>
      )}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted group-hover:text-primary-500 transition-colors shrink-0"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}

/* ─── PR Card ────────────────────────────────────────────────────────────── */

function PRCard({ event, distance, date }: { event: string; distance: number; date: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">{formatEventName(event)}</p>
        <p className="text-xs text-muted">{formatRelativeDate(date)}</p>
      </div>
      <span className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
        {distance.toFixed(2)}m
      </span>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function AthleteDashboardPage() {
  const { athlete } = await requireAthleteSession();

  const [stats, upcoming, trend, recentPRs, guide] = await Promise.all([
    getAthleteStats(athlete.id),
    getAthleteUpcomingSessions(athlete.id, 5),
    getAthleteReadinessTrend(athlete.id, 7),
    getAthleteRecentPRs(athlete.id, 4),
    getAthleteOnboardingGuide(athlete.id, athlete.onboardingCompletedAt),
  ]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const latestReadiness = trend[trend.length - 1] ?? null;
  const checkedInToday =
    latestReadiness && formatRelativeDate(latestReadiness.date) === "Today";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
              Good morning, {athlete.firstName}.
            </h1>
            {stats.currentStreak > 0 && (
              <StreakBadge days={stats.currentStreak} isActive={stats.currentStreak > 0} />
            )}
          </div>
          <p className="text-sm text-muted mt-0.5">{today}</p>
        </div>
        {!checkedInToday && (
          <Link href="/athlete/wellness" className="btn btn-primary text-sm">
            Check In
          </Link>
        )}
      </div>

      {/* Post-onboarding welcome card */}
      {guide.showGuide && (
        <WelcomeCard firstName={athlete.firstName} guide={guide} />
      )}

      {/* Top row: Readiness widget + stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Readiness widget — tap to expand breakdown */}
        <ReadinessWidget data={stats.latestReadiness} />

        <StatCard
          value={stats.totalSessionsAllTime}
          label="Total Sessions"
          sub={stats.longestStreak > 0 ? `Best streak: ${stats.longestStreak}d` : undefined}
        />
        <StatCard
          value={stats.sessionsThisWeek}
          label="Sessions This Week"
        />
        <StatCard
          value={stats.activeGoalsCount}
          label="Active Goals"
          color={stats.activeGoalsCount > 0 ? "text-primary-500" : "text-[var(--foreground)]"}
        />
      </div>

      {/* Training Volume */}
      <VolumeWidget />

      {/* Quick Actions */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <Link
          href="/athlete/log-session"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-primary-500 text-white hover:bg-primary-600 transition-colors shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Log Session
        </Link>
        <Link
          href="/athlete/assessments"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-surface-100 dark:bg-surface-800 text-[var(--foreground)] hover:bg-surface-200 dark:hover:bg-surface-700 border border-surface-200 dark:border-surface-700 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500 shrink-0">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
          Testing History
        </Link>
        <Link
          href="/athlete/wellness"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-surface-100 dark:bg-surface-800 text-[var(--foreground)] hover:bg-surface-200 dark:hover:bg-surface-700 border border-surface-200 dark:border-surface-700 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500 shrink-0">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Wellness Check-in
        </Link>
      </div>

      {/* Two-column body */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Upcoming sessions */}
        <section className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Upcoming Sessions
            </h2>
            <Link
              href="/athlete/sessions"
              className="text-xs text-primary-500 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="card py-1">
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 px-4 gap-3">
                <div className="w-11 h-11 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-surface-400 dark:text-surface-500" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="max-w-[220px]">
                  <p className="text-sm font-semibold text-[var(--foreground)]">No upcoming sessions</p>
                  <p className="text-xs text-muted mt-1">
                    Your coach hasn&apos;t scheduled any sessions yet. Check back soon!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {upcoming.map((s) => (
                  <UpcomingSessionCard key={s.id} session={s} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Personal bests */}
        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Personal Bests
            </h2>
            <Link
              href="/athlete/throws"
              className="text-xs text-primary-500 hover:underline"
            >
              History
            </Link>
          </div>
          <div className="card py-1">
            {recentPRs.length === 0 ? (
              <div className="flex flex-col items-center text-center py-10 px-4 gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div className="max-w-[220px]">
                  <p className="text-sm font-semibold text-[var(--foreground)]">No personal bests yet</p>
                  <p className="text-xs text-muted mt-1">
                    Once you log throws, your best marks will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                {recentPRs.map((pr) => (
                  <PRCard
                    key={pr.id}
                    event={pr.event}
                    distance={pr.distance}
                    date={pr.date}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
