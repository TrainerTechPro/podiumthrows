import Link from "next/link";
import { cookies } from "next/headers";
import { cn } from "@/lib/utils";
import { Avatar, Badge } from "@/components";
import {
  Heart,
  Award,
  CheckCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from "lucide-react";
import prisma from "@/lib/prisma";
import {
  requireCoachSession,
  getCoachStats,
  getRecentActivity,
  getFlaggedAthletes,
  getTeamReadinessTrends,
  getOnboardingStatus,
  PLAN_LIMITS,
  type ActivityItem,
  type CoachStats,
  type TeamReadinessEntry,
} from "@/lib/data/coach";
import { getCoachingActions } from "@/lib/data/coaching-actions";
import { getRecentTeamPRs, getTeamLoadOverview, getUpcomingCompetitions } from "@/lib/data/dashboard-intel";
import { OnboardingChecklist } from "./_onboarding-checklist";
import { CheckoutTrigger } from "./_checkout-trigger";
import { UpgradeBanner } from "./_upgrade-banner";
import { FirstVisitHints } from "./_first-visit-hints";
import { ModeSelector } from "./_mode-selector";
import type { DashboardMode, DashboardDepth } from "./_mode-selector";
import { ActionCards } from "./_action-cards";
import { PRBoard } from "./_pr-board";
import { LoadOverview } from "./_load-overview";
import { CompetitionCountdown } from "./_competition-countdown";
import { PeakingStatus } from "./_peaking-status";
import { AdaptationProgress } from "./_adaptation-progress";
import type { AdaptationRow } from "./_adaptation-progress";

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
        <span className="font-semibold tabular-nums text-[var(--foreground)]">{stats.totalAthletes}</span>
        {" athletes on roster"}
      </span>

      {stats.sessionsToday > 0 && (
        <span>
          <span className="font-semibold tabular-nums text-[var(--foreground)]">{stats.sessionsToday}</span>
          {" session"}{stats.sessionsToday !== 1 ? "s" : ""}{" today"}
        </span>
      )}

      {stats.complianceRate !== null && (
        <span>
          <span className={cn(
            "font-semibold tabular-nums",
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

      {stats.throwsThisWeek > 0 && (
        <span>
          <span className="font-semibold tabular-nums text-[var(--foreground)]">{stats.throwsThisWeek}</span>
          {" throws this week"}
        </span>
      )}

      {stats.prsThisWeek > 0 && (
        <Badge variant="primary">
          {stats.prsThisWeek} PR{stats.prsThisWeek !== 1 ? "s" : ""} this week
        </Badge>
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
        <Heart className="w-4 h-4 text-blue-500" strokeWidth={1.75} aria-hidden="true" />
      </div>
    );
  }
  if (type === "personal_best") {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
        <Award className="w-4 h-4 text-amber-500" strokeWidth={1.75} aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
      <CheckCircle className="w-4 h-4 text-emerald-500" strokeWidth={1.75} aria-hidden="true" />
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
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10 px-4 gap-3">
        <div className="w-11 h-11 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
          <Activity className="w-5 h-5 text-surface-400 dark:text-surface-500" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="max-w-[200px]">
          <p className="text-sm font-semibold text-[var(--foreground)]">No recent activity</p>
          <p className="text-xs text-muted mt-1">
            Check-ins, sessions, and PRs from your athletes will show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline spine */}
      <div className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-surface-200 dark:bg-surface-700" />

      {items.map((item) => (
        <Link
          key={item.id}
          href={`/coach/athletes/${item.athleteId}`}
          className="relative flex items-start gap-3 px-1 py-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
        >
          <div className="relative z-10 shrink-0">
            <ActivityIcon type={item.type} />
          </div>
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

/* ─── Team Readiness Widget ─────────────────────────────────────────────── */

function TrendIcon({ trend }: { trend: TeamReadinessEntry["trend"] }) {
  if (trend === "up") {
    return <TrendingUp size={14} strokeWidth={1.75} className="text-emerald-500" aria-hidden="true" />;
  }
  if (trend === "down") {
    return <TrendingDown size={14} strokeWidth={1.75} className="text-red-500" aria-hidden="true" />;
  }
  if (trend === "stable") {
    return <Minus size={14} strokeWidth={1.75} className="text-surface-400" aria-hidden="true" />;
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
      <div className="divide-y divide-[var(--card-border)] border-t border-[var(--card-border)]">
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
              className="group flex items-center gap-3 px-1 py-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
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
                <div className="mt-1 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 group-hover:bg-surface-300 dark:group-hover:bg-surface-600 overflow-hidden transition-colors">
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
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function CoachDashboardPage() {
  const { coach } = await requireCoachSession();

  // Read mode/depth preferences from cookies
  const cookieStore = cookies();
  const mode = (cookieStore.get("dashboard-mode")?.value ?? "training") as DashboardMode;
  const depth = (cookieStore.get("dashboard-depth")?.value ?? "standard") as DashboardDepth;

  const [
    statsResult,
    activityResult,
    flaggedResult,
    readinessResult,
    onboardingResult,
    actionsResult,
    prsResult,
    loadResult,
    competitionsResult,
  ] = await Promise.allSettled([
    getCoachStats(coach.id),
    getRecentActivity(coach.id, 20, true),
    getFlaggedAthletes(coach.id),
    getTeamReadinessTrends(coach.id),
    getOnboardingStatus(coach.id, coach.onboardingCompletedAt),
    getCoachingActions(coach.id),
    getRecentTeamPRs(coach.id),
    getTeamLoadOverview(coach.id),
    mode === "competition" ? getUpcomingCompetitions(coach.id) : Promise.resolve([]),
  ]);

  const stats: CoachStats = statsResult.status === "fulfilled"
    ? statsResult.value
    : { totalAthletes: 0, lowReadiness: 0, sessionsToday: 0, injured: 0, complianceRate: null, throwsThisWeek: 0, prsThisWeek: 0 };
  const activity = activityResult.status === "fulfilled" ? activityResult.value : [];
  const flagged = flaggedResult.status === "fulfilled" ? flaggedResult.value : [];
  const readiness = readinessResult.status === "fulfilled" ? readinessResult.value : [];
  const onboarding = onboardingResult.status === "fulfilled"
    ? onboardingResult.value
    : { isCompleted: true, completedAt: null, steps: [], completedCount: 0, totalSteps: 0 };
  const coachingActions = actionsResult.status === "fulfilled" ? actionsResult.value : [];
  const teamPRs = prsResult.status === "fulfilled" ? prsResult.value : [];
  const teamLoad = loadResult.status === "fulfilled" ? loadResult.value : [];
  const competitions = competitionsResult.status === "fulfilled" ? competitionsResult.value : [];

  // Adaptation progress — Training Block + Advanced depth only
  const adaptationRows: AdaptationRow[] = [];
  if (mode === "training" && depth === "advanced") {
    try {
      const checkpoints = await prisma.adaptationCheckpoint.findMany({
        where: {
          program: { coachId: coach.id, athleteId: { not: null } },
          applied: false,
        },
        include: {
          program: {
            select: {
              athleteId: true,
              athlete: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const seen = new Set<string>();
      for (const cp of checkpoints) {
        const aid = cp.program.athleteId;
        if (!aid || seen.has(aid)) continue;
        seen.add(aid);
        const athlete = cp.program.athlete!;
        adaptationRows.push({
          athleteId: aid,
          athleteName: `${athlete.firstName} ${athlete.lastName}`,
          avatarUrl: athlete.avatarUrl,
          complexNumber: cp.complexNumber,
          sessionsInComplex: cp.weekNumber,
          sessionsToForm: null,
          markSlope: cp.markSlope,
          markTrend: cp.markTrend,
          recommendation: cp.recommendation,
        });
      }
    } catch (err) {
      console.error("[dashboard] Adaptation checkpoint query failed:", err);
    }
  }

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
      {/* Auto-initiate Stripe Checkout if ?checkout= param present */}
      <CheckoutTrigger />

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

      {/* Upgrade nudge for free coaches near their athlete limit */}
      {coach.plan === "FREE" && stats.totalAthletes >= 2 && (
        <UpgradeBanner
          athleteCount={stats.totalAthletes}
          planLimit={planLimit}
        />
      )}

      {/* ═══ ZONE 1: TRIAGE ═══ */}

      {/* Persistent injury alert bar */}
      {(() => {
        const injured = flagged.filter((a) => a.reason === "injured");
        if (injured.length === 0) return null;
        return (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <p className="text-sm text-red-700 dark:text-red-400 flex-1">
              {injured.length === 1 ? (
                <>
                  <Link href={`/coach/athletes/${injured[0].id}`} className="font-semibold hover:underline">
                    {injured[0].firstName} {injured[0].lastName}
                  </Link>
                  {" has an active injury"}
                </>
              ) : (
                <>
                  <strong>{injured.length}</strong>
                  {" athletes need attention"}
                </>
              )}
            </p>
            <Link
              href="/coach/athletes"
              className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline shrink-0"
            >
              {injured.length === 1 ? "View profile \u2192" : "View all \u2192"}
            </Link>
          </div>
        );
      })()}

      {/* Header: greeting + mode selector */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
              {greeting}, {coach.firstName}.
            </h1>
            <p className="text-sm text-muted mt-0.5">{today}</p>
          </div>
          <ModeSelector mode={mode} depth={depth} />
        </div>
        <StatBar stats={stats} />
      </div>

      {/* Coaching Action Cards */}
      <ActionCards actions={coachingActions} depth={depth} />

      {/* ═══ ZONE 2: TEAM PULSE ═══ */}

      {/* Competition Countdown — only in competition prep mode */}
      {mode === "competition" && competitions.length > 0 && (
        <CompetitionCountdown competitions={competitions} />
      )}

      {/* Two-column: Activity Feed + Readiness */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Activity Feed — timeline, left column */}
        <section className="lg:col-span-3 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Recent Activity
            <span className="ml-2 text-xs font-normal normal-case text-surface-400">
              notable events
            </span>
          </h2>
          <ActivityFeed items={activity} />
          {activity.length > 0 && (
            <div className="pt-1 pl-1">
              <Link
                href="/coach/athletes"
                className="text-xs text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors"
              >
                View All &rarr;
              </Link>
            </div>
          )}
        </section>

        {/* Team Readiness — borderless, right column */}
        <div className="lg:col-span-2">
          <ReadinessWidget entries={readiness} />
        </div>
      </div>

      {/* ═══ ZONE 3: INTEL ═══ */}

      {/* PR Board */}
      <PRBoard prs={teamPRs} />

      {/* Training Load Overview */}
      <LoadOverview entries={teamLoad} depth={depth} />

      {/* Context section — mode-dependent */}
      {mode === "training" && depth === "advanced" && adaptationRows.length > 0 && (
        <AdaptationProgress rows={adaptationRows} />
      )}
      {mode === "competition" && (
        <PeakingStatus competitions={competitions} readiness={readiness} />
      )}

      {/* First-visit contextual hints */}
      <FirstVisitHints />
    </div>
  );
}
