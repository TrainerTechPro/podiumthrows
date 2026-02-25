import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import {
  requireAthleteSession,
  getAthleteStats,
  getAthleteUpcomingSessions,
} from "@/lib/data/athlete";
import {
  getAthleteReadinessTrend,
  getAthleteRecentPRs,
} from "@/lib/data/coach";

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

/* ─── Readiness Ring ─────────────────────────────────────────────────────── */

function ReadinessRing({ score }: { score: number }) {
  const pct = score / 10;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color =
    score >= 8 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-200 dark:text-surface-700" />
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums font-heading" style={{ color }}>
          {score.toFixed(1)}
        </span>
        <span className="text-[10px] text-muted uppercase tracking-wide">Readiness</span>
      </div>
    </div>
  );
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
  return (
    <div className="card px-5 py-4">
      <p className={cn("text-2xl font-bold tabular-nums font-heading", color)}>{value}</p>
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

  const [stats, upcoming, trend, recentPRs] = await Promise.all([
    getAthleteStats(athlete.id),
    getAthleteUpcomingSessions(athlete.id, 5),
    getAthleteReadinessTrend(athlete.id, 7),
    getAthleteRecentPRs(athlete.id, 4),
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Good morning, {athlete.firstName}.
          </h1>
          <p className="text-sm text-muted mt-0.5">{today}</p>
        </div>
        {!checkedInToday && (
          <Link href="/athlete/wellness" className="btn btn-primary text-sm shrink-0">
            Check In
          </Link>
        )}
      </div>

      {/* Top row: Readiness widget + stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Readiness widget */}
        <div className="card px-5 py-4 flex items-center gap-4 sm:col-span-2 lg:col-span-1">
          {stats.latestReadiness ? (
            <>
              <ReadinessRing score={stats.latestReadiness.overallScore} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {stats.latestReadiness.overallScore >= 8
                    ? "Feeling great"
                    : stats.latestReadiness.overallScore >= 5
                    ? "Moderate readiness"
                    : "Low readiness"}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {formatRelativeDate(stats.latestReadiness.date)}
                </p>
                {stats.latestReadiness.injuryStatus === "ACTIVE" && (
                  <Badge variant="danger" className="mt-1.5">Injured</Badge>
                )}
                {stats.latestReadiness.injuryStatus === "MONITORING" && (
                  <Badge variant="warning" className="mt-1.5">Watch</Badge>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1">
              <p className="text-sm font-medium text-muted">No check-in yet</p>
              <Link href="/athlete/wellness" className="text-xs text-primary-500 hover:underline mt-0.5 inline-block">
                Submit today&apos;s check-in →
              </Link>
            </div>
          )}
        </div>

        <StatCard
          value={`🔥 ${stats.currentStreak}`}
          label="Day Streak"
          sub={stats.longestStreak > 0 ? `Best: ${stats.longestStreak}` : undefined}
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
              <p className="text-sm text-muted py-8 text-center">
                No sessions scheduled.
              </p>
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
              <p className="text-sm text-muted py-8 text-center">
                No personal bests recorded yet.
              </p>
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
