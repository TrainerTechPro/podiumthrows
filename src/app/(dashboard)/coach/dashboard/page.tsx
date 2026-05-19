import Link from "next/link";
import { cookies } from "next/headers";
import { Avatar } from "@/components";
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
  getTeamReadinessTrends,
  getOnboardingStatus,
  PLAN_LIMITS,
  type ActivityItem,
  type TeamReadinessEntry,
} from "@/lib/data/coach";
import {
  cachedGetCoachStats,
  cachedGetRecentActivity,
  cachedGetFlaggedAthletes,
} from "@/lib/cache";
import { withTiming } from "@/lib/perf";
import { getCoachingActions } from "@/lib/data/coaching-actions";
import { getTeamAttendanceStats } from "@/lib/data/practices";
import {
  getRecentTeamPRs,
  getTeamLoadOverview,
  getUpcomingCompetitions,
  getTeamDistanceDelta,
  getWeeklyVolumeBreakdown,
  getSeasonGains,
  getThisWeekSummary,
} from "@/lib/data/dashboard-intel";
import { OnboardingChecklist } from "./_onboarding-checklist";
import { CheckoutTrigger } from "./_checkout-trigger";
import { UpgradeBanner } from "./_upgrade-banner";
import { ModeSelector } from "./_mode-selector";
import type { DashboardMode, DashboardDepth } from "./_mode-selector";
import { ActionCards } from "./_action-cards";
import { PRBoard } from "./_pr-board";
import { LoadOverview } from "./_load-overview";
import { CompetitionCountdown } from "./_competition-countdown";
import { PeakingStatus } from "./_peaking-status";
import { AdaptationProgress } from "./_adaptation-progress";
import type { AdaptationRow } from "./_adaptation-progress";
import { AnalyticsSection } from "./_analytics-section";
import { ThisWeek } from "./_this-week";

import { logger } from "@/lib/logger";
/* ─── Coach Dashboard — editorial, scientific, back-office ────────────────────
   Per Dual Product Identity: the coach desktop is the tool that sells the
   subscription. It should feel like research software, not a gamified app.
   Single editorial column. No greeting. No animated numbers. Dense but
   calm. Hairlines over cards. Color earns its place — status only.

   What a coach scans on open:
     1. Alerts (injuries) — if any.
     2. Meta bar — roster, today, compliance, PRs, flags. One line.
     3. Coaching actions — what needs a decision.
     4. Activity + readiness — what happened, how they're feeling.
     5. Results — PRs, load.
     6. Analytics — the slow lens.

   Gutted from the old dashboard:
     - "Good morning, {name}." (greeting ceremony)
     - Zone headers with ═══ separators
     - AnimatedNumber on every stat (count-up theatrics erode trust)
     - Hero gradient cards around simple data
     - `tracking-wider uppercase` shouting on every section header
   ─────────────────────────────────────────────────────────────────────── */

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

/* ─── Editorial Section Header ───────────────────────────────────────────
   One consistent pattern for every section. No uppercase tracking-wider —
   that register is reserved for labels, not headings. Editorial weight. */
function SectionHeader({
  title,
  context,
  action,
}: {
  title: string;
  context?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4 pb-3 border-b border-[var(--color-border-default)]">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h2 className="font-heading text-body-lg font-semibold text-[var(--color-text-primary)] tracking-tight">
          {title}
        </h2>
        {context && (
          <span className="text-xs text-[var(--color-text-secondary)] truncate">{context}</span>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}

/* ─── Activity Feed ──────────────────────────────────────────────────────── */

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  if (type === "check_in") {
    return (
      <div className="w-7 h-7 rounded-full bg-[var(--color-status-info-bg)] flex items-center justify-center shrink-0">
        <Heart
          className="w-3.5 h-3.5"
          strokeWidth={1.75}
          style={{ color: "var(--color-status-info-fg)" }}
          aria-hidden="true"
        />
      </div>
    );
  }
  if (type === "personal_best") {
    return (
      <div className="w-7 h-7 rounded-full bg-[var(--color-brand-subtle)] flex items-center justify-center shrink-0">
        <Award
          className="w-3.5 h-3.5"
          strokeWidth={1.75}
          style={{ color: "var(--color-brand-strong)" }}
          aria-hidden="true"
        />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-[var(--color-status-success-bg)] flex items-center justify-center shrink-0">
      <CheckCircle
        className="w-3.5 h-3.5"
        strokeWidth={1.75}
        style={{ color: "var(--color-status-success-fg)" }}
        aria-hidden="true"
      />
    </div>
  );
}

function ActivityDescription({ item }: { item: ActivityItem }) {
  if (item.type === "check_in") {
    const score = item.score ?? 0;
    const scoreStyle =
      score >= 8
        ? { color: "var(--color-status-success-fg)" }
        : score >= 5
          ? { color: "var(--color-status-warning-fg)" }
          : { color: "var(--color-status-danger-fg)" };
    return (
      <span>
        <span className="font-medium text-[var(--color-text-primary)]">{item.athleteName}</span>
        {" checked in · readiness "}
        <span className="font-semibold tabular-nums" style={scoreStyle}>
          {item.score?.toFixed(1)}
        </span>
      </span>
    );
  }
  if (item.type === "personal_best") {
    return (
      <span>
        <span className="font-medium text-[var(--color-text-primary)]">{item.athleteName}</span>
        {" set a PR of "}
        <span className="font-semibold tabular-nums" style={{ color: "var(--color-brand-strong)" }}>
          {item.distance?.toFixed(2)}m
        </span>
        {" in "}
        <span className="font-medium text-[var(--color-text-primary)]">
          {formatEventName(item.event ?? "")}
        </span>
      </span>
    );
  }
  return (
    <span>
      <span className="font-medium text-[var(--color-text-primary)]">{item.athleteName}</span>
      {item.sessionName ? (
        <>
          {" completed "}
          <span className="font-medium text-[var(--color-text-primary)]">{item.sessionName}</span>
        </>
      ) : (
        " completed a session"
      )}
      {item.rpe != null && (
        <>
          {" · RPE "}
          <span className="font-semibold tabular-nums">{item.rpe.toFixed(1)}</span>
        </>
      )}
      {item.distance != null && (
        <>
          {" · best "}
          <span
            className="font-semibold tabular-nums"
            style={{ color: "var(--color-status-success-fg)" }}
          >
            {item.distance.toFixed(2)}m
          </span>
        </>
      )}
    </span>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-sm text-[var(--color-text-secondary)]">
        <Activity
          size={18}
          strokeWidth={1.75}
          aria-hidden="true"
          className="inline-block mr-2 -mt-0.5"
        />
        No check-ins, sessions, or PRs yet — activity from your athletes will appear here.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-border-default)]">
      {items.map((item) => {
        const href = item.assignmentId
          ? `/coach/throws/${item.assignmentId}?athlete=${item.athleteId}`
          : `/coach/athletes/${item.athleteId}`;
        return (
          <li key={item.id}>
            <Link
              href={href}
              className="flex items-start gap-3 py-3 hover:bg-[var(--color-bg-surface-sunken)] -mx-2 px-2 rounded transition-colors"
            >
              <ActivityIcon type={item.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-secondary)] leading-snug">
                  <ActivityDescription item={item} />
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] opacity-60 mt-0.5">
                  {formatRelativeTime(item.date)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ─── Team Readiness ─────────────────────────────────────────────────────── */

function TrendIcon({ trend }: { trend: TeamReadinessEntry["trend"] }) {
  if (trend === "up") {
    return (
      <TrendingUp
        size={14}
        strokeWidth={1.75}
        style={{ color: "var(--color-status-success-fg)" }}
        aria-hidden="true"
      />
    );
  }
  if (trend === "down") {
    return (
      <TrendingDown
        size={14}
        strokeWidth={1.75}
        style={{ color: "var(--color-status-danger-fg)" }}
        aria-hidden="true"
      />
    );
  }
  if (trend === "stable") {
    return (
      <Minus
        size={14}
        strokeWidth={1.75}
        style={{ color: "var(--color-text-secondary)" }}
        aria-hidden="true"
      />
    );
  }
  return null;
}

function ReadinessSparkline({
  series,
  maxScore,
  strokeVar,
}: {
  series: { date: string; score: number | null }[];
  maxScore: number;
  strokeVar: string;
}) {
  const W = 72;
  const H = 18;
  const PAD = 1.5;

  if (series.length === 0 || maxScore <= 0) {
    return <div className="h-[18px] w-[72px]" aria-hidden="true" />;
  }

  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];

  series.forEach((pt, i) => {
    if (pt.score == null) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      return;
    }
    const x = PAD + (i / Math.max(1, series.length - 1)) * (W - 2 * PAD);
    const yNorm = Math.min(1, Math.max(0, pt.score / maxScore));
    const y = PAD + (1 - yNorm) * (H - 2 * PAD);
    current.push({ x, y });
  });
  if (current.length > 0) segments.push(current);

  if (segments.length === 0) {
    return (
      <div
        className="h-[18px] w-[72px] flex items-center text-nano"
        style={{ color: "var(--color-text-secondary)" }}
        aria-hidden="true"
      >
        —
      </div>
    );
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      {segments.map((seg, idx) =>
        seg.length === 1 ? (
          <circle key={idx} cx={seg[0].x} cy={seg[0].y} r={1.2} style={{ fill: strokeVar }} />
        ) : (
          <polyline
            key={idx}
            points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: strokeVar }}
          />
        )
      )}
    </svg>
  );
}

function ReadinessWidget({ entries }: { entries: TeamReadinessEntry[] }) {
  if (entries.length === 0) {
    return (
      <section aria-labelledby="readiness-heading">
        <SectionHeader title="Team readiness" context="last 28 days" />
        <p className="text-sm text-[var(--color-text-secondary)] py-2">
          No check-ins yet — readiness sparks land here once your athletes start logging.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="readiness-heading">
      <SectionHeader title="Team readiness" context="last 28 days" />
      <ul className="divide-y divide-[var(--color-border-default)]">
        {entries.map((entry) => {
          const pct =
            entry.maxScore > 0 && entry.latestScore !== null
              ? (entry.latestScore / entry.maxScore) * 100
              : 0;
          const strokeVar =
            pct >= 70
              ? "var(--color-status-success-fg)"
              : pct >= 40
                ? "var(--color-status-warning-fg)"
                : "var(--color-status-danger-fg)";

          return (
            <li key={entry.athleteId}>
              <Link
                href={`/coach/athletes/${entry.athleteId}`}
                className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded hover:bg-[var(--color-bg-surface-sunken)] transition-colors"
              >
                <Avatar name={entry.athleteName} src={entry.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {entry.athleteName}
                  </p>
                  <div className="mt-0.5">
                    <ReadinessSparkline
                      series={entry.series}
                      maxScore={entry.maxScore}
                      strokeVar={strokeVar}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <TrendIcon trend={entry.trend} />
                  <span className="text-sm font-semibold tabular-nums" style={{ color: strokeVar }}>
                    {entry.latestScore !== null ? entry.latestScore.toFixed(1) : "—"}
                  </span>
                  <span className="text-nano text-[var(--color-text-secondary)]">
                    / {entry.maxScore}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ─── Meta Bar — the editorial page header ──────────────────────────────
   Dense, one-line (wraps on narrow), fact-first. No greeting. The date
   is the heading; every number stands on its own weight. Color is reserved
   for signals the coach needs to act on (PR, warning, danger). */

function MetaBar({
  today,
  totalAthletes,
  sessionsToday,
  complianceRate,
  throwsThisWeek,
  attendance,
}: {
  today: string;
  totalAthletes: number;
  sessionsToday: number;
  complianceRate: number | null;
  throwsThisWeek: number;
  attendance: {
    rate: number;
    totalPractices: number;
    flaggedCount: number;
  } | null;
}) {
  // Editorial-grade link: looks like the surrounding text, underlines on hover.
  // Every linked number lands on a filtered surface — see tasks/mvp-weekly-loop.md.
  const linkCls =
    "hover:underline underline-offset-2 decoration-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:underline";
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-sm text-[var(--color-text-secondary)]">
      <span className="text-[var(--color-text-primary)] font-medium">{today}</span>

      <Dot />

      <Link
        href="/coach/athletes"
        className={linkCls}
        aria-label={`${totalAthletes} athletes — open roster`}
      >
        <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
          {totalAthletes}
        </span>{" "}
        athlete{totalAthletes === 1 ? "" : "s"}
      </Link>

      {sessionsToday > 0 && (
        <>
          <Dot />
          <Link
            href="/coach/calendar"
            className={linkCls}
            aria-label={`${sessionsToday} sessions today — open calendar`}
          >
            <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
              {sessionsToday}
            </span>{" "}
            session{sessionsToday === 1 ? "" : "s"} today
          </Link>
        </>
      )}

      {complianceRate !== null && (
        <>
          <Dot />
          <span>
            <span
              className="font-semibold tabular-nums"
              style={{
                color:
                  complianceRate >= 80
                    ? "var(--color-status-success-fg)"
                    : complianceRate < 60
                      ? "var(--color-status-warning-fg)"
                      : "var(--color-text-primary)",
              }}
            >
              {complianceRate}%
            </span>{" "}
            compliance · 30d
          </span>
        </>
      )}

      {throwsThisWeek > 0 && (
        <>
          <Dot />
          <Link
            href="/coach/athletes?tab=throws"
            className={linkCls}
            aria-label={`${throwsThisWeek} throws this week — open team throws view`}
          >
            <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">
              {throwsThisWeek}
            </span>{" "}
            throws this week
          </Link>
        </>
      )}

      {attendance !== null && attendance.totalPractices > 0 && (
        <>
          <Dot />
          <Link
            href="/coach/calendar"
            className={linkCls}
            aria-label={`${attendance.rate}% attendance this week — open calendar`}
          >
            <span
              className="font-semibold tabular-nums"
              style={{
                color:
                  attendance.rate >= 90
                    ? "var(--color-status-success-fg)"
                    : attendance.rate >= 75
                      ? "var(--color-status-warning-fg)"
                      : "var(--color-status-danger-fg)",
              }}
            >
              {attendance.rate}%
            </span>{" "}
            attendance · this week
          </Link>
        </>
      )}
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="opacity-40">
      ·
    </span>
  );
}

/* ─── Injury Alert — urgent triage ───────────────────────────────────── */

function InjuryAlert({
  injured,
}: {
  injured: { id: string; firstName: string; lastName: string }[];
}) {
  if (injured.length === 0) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-lg border px-4 py-3"
      style={{
        backgroundColor: "var(--color-status-danger-bg)",
        borderColor: "var(--color-status-danger-fg)",
        borderWidth: "1px",
      }}
    >
      <AlertTriangle
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        className="mt-0.5 shrink-0"
        style={{ color: "var(--color-status-danger-fg)" }}
      />
      <p className="flex-1 text-sm" style={{ color: "var(--color-status-danger-fg)" }}>
        {injured.length === 1 ? (
          <>
            <Link
              href={`/coach/athletes/${injured[0].id}`}
              className="font-semibold hover:underline"
            >
              {injured[0].firstName} {injured[0].lastName}
            </Link>{" "}
            has an active injury flag.
          </>
        ) : (
          <>
            <span className="font-semibold">{injured.length} athletes</span> have active injury
            flags.
          </>
        )}
      </p>
      <Link
        href="/coach/athletes"
        className="text-xs font-semibold shrink-0 hover:underline"
        style={{ color: "var(--color-status-danger-fg)" }}
      >
        {injured.length === 1 ? "View profile →" : "View all →"}
      </Link>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function CoachDashboardPage() {
  const { coach } = await requireCoachSession();

  const cookieStore = await cookies();
  const mode = (cookieStore.get("dashboard-mode")?.value ?? "training") as DashboardMode;
  const depth = (cookieStore.get("dashboard-depth")?.value ?? "standard") as DashboardDepth;
  const analyticsPeriod = Number(cookieStore.get("dashboard-analytics-period")?.value) || 30;

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
    distanceDeltaResult,
    weeklyVolumeResult,
    seasonGainsResult,
    teamAttendanceResult,
    thisWeekResult,
  ] = await withTiming("coach-dashboard-data", () =>
    Promise.allSettled([
      cachedGetCoachStats(coach.id),
      cachedGetRecentActivity(coach.id, 15, true),
      cachedGetFlaggedAthletes(coach.id),
      getTeamReadinessTrends(coach.id),
      getOnboardingStatus(coach.id, coach.onboardingCompletedAt),
      getCoachingActions(coach.id),
      getRecentTeamPRs(coach.id),
      getTeamLoadOverview(coach.id),
      mode === "competition" ? getUpcomingCompetitions(coach.id) : Promise.resolve([]),
      getTeamDistanceDelta(coach.id, analyticsPeriod),
      getWeeklyVolumeBreakdown(coach.id),
      getSeasonGains(coach.id, analyticsPeriod),
      getTeamAttendanceStats(coach.id, 7),
      getThisWeekSummary(coach.id),
    ])
  );

  const stats =
    statsResult.status === "fulfilled"
      ? statsResult.value
      : {
          totalAthletes: 0,
          lowReadiness: 0,
          sessionsToday: 0,
          injured: 0,
          complianceRate: null,
          throwsThisWeek: 0,
          prsThisWeek: 0,
        };
  const activity = activityResult.status === "fulfilled" ? activityResult.value : [];
  const flagged = flaggedResult.status === "fulfilled" ? flaggedResult.value : [];
  const readiness = readinessResult.status === "fulfilled" ? readinessResult.value : [];
  const onboarding =
    onboardingResult.status === "fulfilled"
      ? onboardingResult.value
      : { isCompleted: true, completedAt: null, steps: [], completedCount: 0, totalSteps: 0 };
  const coachingActions = actionsResult.status === "fulfilled" ? actionsResult.value : [];
  const teamPRs = prsResult.status === "fulfilled" ? prsResult.value : [];
  const teamLoad = loadResult.status === "fulfilled" ? loadResult.value : [];
  const competitions = competitionsResult.status === "fulfilled" ? competitionsResult.value : [];
  const distanceDelta =
    distanceDeltaResult.status === "fulfilled"
      ? distanceDeltaResult.value
      : { avgDeltaPercent: 0, athleteCount: 0, totalAthletes: 0 };
  const weeklyVolume =
    weeklyVolumeResult.status === "fulfilled"
      ? weeklyVolumeResult.value
      : {
          days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((l) => ({
            label: l,
            throws: 0,
            date: "",
          })),
          todayIndex: 0,
        };
  const seasonGains = seasonGainsResult.status === "fulfilled" ? seasonGainsResult.value : [];
  const teamAttendance =
    teamAttendanceResult.status === "fulfilled" ? teamAttendanceResult.value : null;
  const thisWeek =
    thisWeekResult.status === "fulfilled"
      ? thisWeekResult.value
      : {
          weekStart: "",
          weekEnd: "",
          notStarted: 0,
          completed: 0,
          prs: 0,
          missingReadiness: 0,
          needsReview: 0,
        };

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
              athlete: {
                select: { id: true, firstName: true, lastName: true, avatarUrl: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
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
      logger.error("[dashboard] Adaptation checkpoint query failed:", {
        context: "coach/dashboard",
        error: err,
      });
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const planLimit = PLAN_LIMITS[coach.plan];
  const injuredAthletes = flagged.filter((a) => a.reason === "injured");

  // Analytics derivation (moved out of JSX for readability)
  const scored = readiness.filter((e) => e.latestScore !== null);
  const avgReadiness =
    scored.length > 0
      ? scored.reduce((sum, e) => sum + (e.latestScore ?? 0), 0) / scored.length
      : 0;
  const ups = readiness.filter((e) => e.trend === "up").length;
  const downs = readiness.filter((e) => e.trend === "down").length;
  const readinessTrend: "up" | "down" | "flat" = ups > downs ? "up" : downs > ups ? "down" : "flat";

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Auto-initiate Stripe Checkout if ?checkout= param present */}
      <CheckoutTrigger />

      {/* Onboarding Checklist — new coaches only */}
      {!onboarding.isCompleted && (
        <OnboardingChecklist
          firstName={coach.firstName}
          status={onboarding}
          athleteCount={stats.totalAthletes}
          planLimit={planLimit}
          currentPlan={coach.plan}
        />
      )}

      {/* Plan upgrade nudge for free coaches near limit */}
      {coach.plan === "FREE" && stats.totalAthletes >= 2 && (
        <UpgradeBanner athleteCount={stats.totalAthletes} planLimit={planLimit} />
      )}

      {/* ── Editorial header ───────────────────────────────────────────── */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              Command
            </p>
            <h1 className="font-heading text-display leading-tight font-semibold text-[var(--color-text-primary)]">
              Your program, today.
            </h1>
          </div>
          <ModeSelector mode={mode} depth={depth} />
        </div>

        <MetaBar
          today={today}
          totalAthletes={stats.totalAthletes}
          sessionsToday={stats.sessionsToday}
          complianceRate={stats.complianceRate}
          throwsThisWeek={stats.throwsThisWeek}
          attendance={
            teamAttendance
              ? {
                  rate: teamAttendance.rate,
                  totalPractices: teamAttendance.totalPractices,
                  flaggedCount: teamAttendance.flaggedAthletes.length,
                }
              : null
          }
        />
      </header>

      {/* ── Triage: injuries ─────────────────────────────────────────── */}
      <InjuryAlert injured={injuredAthletes} />

      {/* ── Above the fold ──────────────────────────────────────────────
          Order matches the goal: action queue → roster readiness risk →
          today's sessions → recent PRs → upcoming competition. Each
          section uses one SectionHeader pattern. ───────────────────── */}

      {/* 1. Action queue — "who needs me today?" */}
      <ActionCards actions={coachingActions} depth={depth} />

      {/* 2. Roster readiness risk — sparkline list of lowest scores first */}
      <ReadinessWidget entries={readiness} />

      {/* 3. Today + this week — sessions/practices grid */}
      <ThisWeek summary={thisWeek} />

      {/* 4. Recent PRs */}
      <section aria-labelledby="prs-heading">
        <SectionHeader title="Recent team PRs" />
        <PRBoard prs={teamPRs} />
      </section>

      {/* 5. Upcoming competition — always render in competition mode,
            otherwise only when something is on the calendar. */}
      {(mode === "competition" || competitions.length > 0) && (
        <CompetitionCountdown competitions={competitions} />
      )}

      {/* ── Slower lens ────────────────────────────────────────────────
          Activity stream + training load + analytics live below the
          fold; coaches who want context scroll, coaches who want a
          decision get one in the first viewport. ───────────────────── */}

      <section aria-labelledby="activity-heading">
        <SectionHeader
          title="Recent activity"
          action={{ label: "All athletes", href: "/coach/athletes" }}
        />
        <ActivityFeed items={activity} />
      </section>

      <section aria-labelledby="load-heading">
        <SectionHeader title="Training load" />
        <LoadOverview entries={teamLoad} depth={depth} />
      </section>

      {mode === "training" && depth === "advanced" && adaptationRows.length > 0 && (
        <section aria-labelledby="adaptation-heading">
          <SectionHeader title="Adaptation status" context="advanced" />
          <AdaptationProgress rows={adaptationRows} />
        </section>
      )}
      {mode === "competition" && (
        <section aria-labelledby="peaking-heading">
          <SectionHeader title="Peaking status" />
          <PeakingStatus competitions={competitions} readiness={readiness} />
        </section>
      )}

      <section aria-labelledby="analytics-heading">
        <SectionHeader title="Analytics" context={`last ${analyticsPeriod} days`} />
        <AnalyticsSection
          period={analyticsPeriod}
          distanceDelta={distanceDelta}
          complianceRate={stats.complianceRate}
          avgReadiness={avgReadiness}
          readinessTrend={readinessTrend}
          weeklyVolume={weeklyVolume}
          seasonGains={seasonGains}
        />
      </section>
    </div>
  );
}
