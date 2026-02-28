import Link from "next/link";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import {
  requireCoachSession,
  getCoachStats,
  getRecentActivity,
  getFlaggedAthletes,
  getTeamReadinessTrends,
  getOnboardingStatus,
  PLAN_LIMITS,
  type ActivityItem,
  type FlaggedAthlete,
  type CoachStats,
  type TeamReadinessEntry,
} from "@/lib/data/coach";
import { OnboardingChecklist } from "./_onboarding-checklist";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Stat Bar ───────────────────────────────────────────────────────────── */

function StatBar({ stats }: { stats: CoachStats }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted border-b border-[var(--card-border)] pb-6">
      <span>
        <span className="font-semibold text-[var(--foreground)]">{stats.totalAthletes}</span>
        {" athletes on roster"}
      </span>

      {stats.sessionsToday > 0 && (
        <span>
          <span className="font-semibold text-[var(--foreground)]">{stats.sessionsToday}</span>
          {" session"}{stats.sessionsToday !== 1 ? "s" : ""}{" today"}
        </span>
      )}

      {stats.complianceRate !== null && (
        <span>
          <span className={cn(
            "font-semibold",
            stats.complianceRate >= 80
              ? "text-emerald-600 dark:text-emerald-400"
              : stats.complianceRate < 60
              ? "text-amber-500"
              : "text-[var(--foreground)]"
          )}>
            {stats.complianceRate}%
          </span>
          {" 30-day compliance"}
        </span>
      )}

      {stats.lowReadiness > 0 && (
        <Badge variant="warning">
          {stats.lowReadiness} low readiness
        </Badge>
      )}

      {stats.injured > 0 && (
        <Badge variant="danger">
          {stats.injured} injured
        </Badge>
      )}
    </div>
  );
}

/* ─── Activity Feed ──────────────────────────────────────────────────────── */

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  if (type === "check_in") {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </div>
    );
  }
  if (type === "personal_best") {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

function ActivityDescription({ item }: { item: ActivityItem }) {
  if (item.type === "check_in") {
    const scoreColor =
      (item.score ?? 0) >= 8
        ? "text-emerald-600 dark:text-emerald-400"
        : (item.score ?? 0) >= 5
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";
    return (
      <span>
        <span className="font-medium text-[var(--foreground)]">{item.athleteName}</span>
        {" submitted a readiness check-in · "}
        <span className={cn("font-semibold", scoreColor)}>
          {item.score?.toFixed(1)}
        </span>
      </span>
    );
  }
  if (item.type === "personal_best") {
    return (
      <span>
        <span className="font-medium text-[var(--foreground)]">{item.athleteName}</span>
        {" set a new PR — "}
        <span className="font-semibold text-amber-600 dark:text-amber-400">
          {item.distance?.toFixed(2)}m
        </span>
        {" in "}
        <span className="font-medium">{formatEventName(item.event ?? "")}</span>
      </span>
    );
  }
  return (
    <span>
      <span className="font-medium text-[var(--foreground)]">{item.athleteName}</span>
      {" completed a training session"}
      {item.rpe != null && (
        <>
          {" · RPE "}
          <span className="font-semibold">{item.rpe.toFixed(1)}</span>
        </>
      )}
    </span>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="space-y-1">
      {items.length === 0 && (
        <p className="text-sm text-muted py-4 text-center">
          No activity in the last 48 hours.
        </p>
      )}
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/coach/athletes/${item.athleteId}`}
          className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
        >
          <ActivityIcon type={item.type} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-snug">
              <ActivityDescription item={item} />
            </p>
            <p className="text-xs text-muted mt-0.5">{formatRelativeTime(item.date)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ─── Flagged Athletes ───────────────────────────────────────────────────── */

function FlaggedCard({ athlete }: { athlete: FlaggedAthlete }) {
  const reasonLabel =
    athlete.reason === "injured"
      ? "Injury Active"
      : athlete.reason === "low_readiness"
      ? `Readiness ${athlete.score?.toFixed(1)}`
      : `No check-in ${athlete.daysSinceCheckin}d`;

  const badgeVariant: "danger" | "warning" | "neutral" =
    athlete.reason === "injured"
      ? "danger"
      : athlete.reason === "low_readiness"
      ? "warning"
      : "neutral";

  return (
    <Link
      href={`/coach/athletes/${athlete.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
    >
      <Avatar
        name={`${athlete.firstName} ${athlete.lastName}`}
        src={athlete.avatarUrl}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)] truncate">
          {athlete.firstName} {athlete.lastName}
        </p>
        <p className="text-xs text-muted truncate">
          {(athlete.events as string[]).map(formatEventName).join(", ") || "No events set"}
        </p>
      </div>
      <Badge variant={badgeVariant}>
        {reasonLabel}
      </Badge>
    </Link>
  );
}

/* ─── Team Readiness Widget ─────────────────────────────────────────────── */

function TrendIcon({ trend }: { trend: TeamReadinessEntry["trend"] }) {
  if (trend === "up") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    );
  }
  if (trend === "down") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
        <polyline points="17 18 23 18 23 12" />
      </svg>
    );
  }
  if (trend === "stable") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );
  }
  return null;
}

function ReadinessWidget({ entries }: { entries: TeamReadinessEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
        Team Readiness
        <span className="ml-2 text-xs font-normal normal-case text-surface-400">
          latest scores
        </span>
      </h2>
      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-[var(--card-border)]">
          {entries.map((entry) => {
            const pct =
              entry.maxScore > 0 && entry.latestScore !== null
                ? (entry.latestScore / entry.maxScore) * 100
                : 0;
            const scoreColorClass =
              pct >= 70
                ? "text-emerald-600 dark:text-emerald-400"
                : pct >= 40
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400";
            const barColorClass =
              pct >= 70
                ? "bg-emerald-500"
                : pct >= 40
                ? "bg-amber-500"
                : "bg-red-500";

            return (
              <Link
                key={entry.athleteId}
                href={`/coach/athletes/${entry.athleteId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <Avatar
                  name={entry.athleteName}
                  src={entry.avatarUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {entry.athleteName}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColorClass}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <TrendIcon trend={entry.trend} />
                  <span className={cn("text-sm font-semibold tabular-nums", scoreColorClass)}>
                    {entry.latestScore !== null
                      ? entry.latestScore.toFixed(1)
                      : "—"}
                  </span>
                  <span className="text-[10px] text-muted">
                    / {entry.maxScore}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function CoachDashboardPage() {
  const { coach } = await requireCoachSession();

  const [stats, activity, flagged, readiness, onboarding] = await Promise.all([
    getCoachStats(coach.id),
    getRecentActivity(coach.id),
    getFlaggedAthletes(coach.id),
    getTeamReadinessTrends(coach.id),
    getOnboardingStatus(coach.id, coach.onboardingCompletedAt),
  ]);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const planLimit = PLAN_LIMITS[coach.plan];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Onboarding Checklist — shown only for new coaches */}
      {!onboarding.isCompleted && (
        <OnboardingChecklist
          firstName={coach.firstName}
          status={onboarding}
          athleteCount={stats.totalAthletes}
          planLimit={planLimit}
          currentPlan={coach.plan}
        />
      )}

      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
              {greeting}, {coach.firstName}.
            </h1>
            <p className="text-sm text-muted mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/coach/athletes"
              className="text-sm text-muted hover:text-[var(--foreground)] transition-colors"
            >
              View Athletes
            </Link>
            <Link
              href="/coach/athletes"
              className="btn-primary text-sm py-1.5 px-3"
            >
              + Invite Athlete
            </Link>
          </div>
        </div>
        <StatBar stats={stats} />
      </div>

      {/* Two-column body */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Activity Feed — left column */}
        <section className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Recent Activity
            <span className="ml-2 text-xs font-normal normal-case text-surface-400">
              last 48 hours
            </span>
          </h2>
          <div className="card py-1">
            <ActivityFeed items={activity} />
          </div>
        </section>

        {/* Flagged Athletes — right column */}
        <section className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Needs Attention
            {flagged.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {flagged.length}
              </span>
            )}
          </h2>
          <div className="card py-1">
            {flagged.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">
                All athletes are in good shape.
              </p>
            ) : (
              <div className="space-y-0.5">
                {flagged.map((a) => (
                  <FlaggedCard key={a.id} athlete={a} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Team Readiness */}
      <ReadinessWidget entries={readiness} />
    </div>
  );
}
