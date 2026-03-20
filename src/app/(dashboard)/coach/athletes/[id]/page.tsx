import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatImplementWeight } from "@/lib/throws";
import { Avatar, Badge, ProgressBar, AnimatedNumber, ScrollProgressBar } from "@/components";
import { ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LineChart, type LineChartDataPoint } from "@/components/charts/LineChart";
import {
  requireCoachSession,
  getAthleteFull,
  getAthleteACWR,
  getAthleteRecentPRs,
  getAthleteSessions,
  getAthleteThrowHistory,
  getAthleteReadinessTrend,
  getAthleteGoals,
  getLatestBondarchukAssessment,
  type AthleteACWR,
  type ThrowLogItem,
  type SessionItem,
  type ReadinessTrendPoint,
  type GoalItem,
} from "@/lib/data/coach";
import { SectionNav } from "./_section-nav";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type AthleteProfile = NonNullable<Awaited<ReturnType<typeof getAthleteFull>>>;

const VALID_SECTIONS = ["overview", "training", "throws", "readiness", "wellness", "goals"];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatEventName(event: string): string {
  return event
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function calcAge(dob: Date | null): string {
  if (!dob) return "—";
  return String(
    Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  );
}

const BONDARCHUK_COLORS: Record<string, "warning" | "primary" | "success" | "danger"> = {
  EXPLOSIVE: "warning",
  SPEED_STRENGTH: "primary",
  STRENGTH_SPEED: "success",
  STRENGTH: "danger",
};

/* ─── Athlete Header ─────────────────────────────────────────────────────── */

function AthleteHeader({
  athlete,
  bondarchukType,
}: {
  athlete: AthleteProfile;
  bondarchukType: string | null;
}) {
  const events = athlete.events as string[];

  return (
    <div className="flex items-start gap-4 sm:gap-5">
      <Link
        href="/coach/athletes"
        className="mt-1 text-muted hover:text-[var(--foreground)] transition-colors shrink-0"
        aria-label="Back to roster"
      >
        <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
      </Link>

      <Avatar
        name={`${athlete.firstName} ${athlete.lastName}`}
        src={athlete.avatarUrl}
        size="lg"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)] leading-tight">
            {athlete.firstName} {athlete.lastName}
          </h1>
          {bondarchukType && (
            <Badge variant={BONDARCHUK_COLORS[bondarchukType] ?? "neutral"}>
              {bondarchukType.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {events.length > 0
            ? events.map((e) => (
                <Badge key={e} variant="neutral">
                  {formatEventName(e)}
                </Badge>
              ))
            : <span className="text-xs text-muted">No events assigned</span>
          }
          {athlete.currentStreak > 0 && (
            <Badge variant="warning">
              🔥 {athlete.currentStreak}d streak
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Decision Hero ─────────────────────────────────────────────────────── */

function DecisionHero({
  athlete,
  bondarchukType,
  acwr,
  latestReadiness,
}: {
  athlete: AthleteProfile;
  bondarchukType: string | null;
  acwr: AthleteACWR;
  latestReadiness: ReadinessTrendPoint | null;
}) {
  const readinessScore = latestReadiness?.overallScore ?? null;
  const readinessColor =
    readinessScore === null ? "text-surface-400"
    : readinessScore >= 8 ? "text-emerald-500"
    : readinessScore >= 5 ? "text-amber-500"
    : "text-red-500";

  const acwrRatio = acwr?.ratio ?? null;
  const acwrLabel = acwr
    ? acwr.ratio > 1.5 ? "High Risk"
      : acwr.ratio > 1.3 ? "Elevated"
      : acwr.ratio < 0.8 ? "Under-trained"
      : "Optimal"
    : "ACWR";
  const acwrColor =
    acwr === null ? "text-surface-400"
    : acwr.ratio > 1.5 ? "text-red-500"
    : acwr.ratio > 1.3 || acwr.ratio < 0.8 ? "text-amber-500"
    : "text-emerald-500";

  const injuryStatus = latestReadiness?.injuryStatus ?? null;
  const isInjured = injuryStatus === "ACTIVE";

  return (
    <div className="rounded-2xl bg-surface-50 dark:bg-surface-800/50 p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex-1 min-w-0">
          <AthleteHeader athlete={athlete} bondarchukType={bondarchukType} />
        </div>

        <div className="flex items-center gap-5 sm:gap-8 shrink-0">
          {/* Readiness */}
          <div className="text-center">
            <p className={cn("text-3xl font-bold font-heading tabular-nums", readinessColor)}>
              {readinessScore !== null ? (
                <AnimatedNumber value={readinessScore} decimals={1} />
              ) : "—"}
            </p>
            <p className="text-[11px] text-muted mt-0.5">Readiness</p>
          </div>

          {/* ACWR */}
          <div className="text-center">
            <p className={cn("text-3xl font-bold font-heading tabular-nums", acwrColor)}>
              {acwrRatio !== null ? (
                <AnimatedNumber value={acwrRatio} decimals={2} />
              ) : "—"}
            </p>
            <p className="text-[11px] text-muted mt-0.5">{acwrLabel}</p>
          </div>

          {/* Injury */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isInjured ? "bg-red-500" : "bg-emerald-500"
              )} />
              <p className={cn(
                "text-sm font-bold",
                isInjured
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}>
                {isInjured ? "Injured" : "Healthy"}
              </p>
            </div>
            <p className="text-[11px] text-muted mt-0.5">
              {isInjured ? "Active injury" : "No injuries"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Overview Tab ───────────────────────────────────────────────────────── */

function ACWRGauge({ acwr }: { acwr: NonNullable<AthleteACWR> }) {
  const { ratio, acute, chronic, sessionsInAcute, sessionsInChronic } = acwr;
  const isDanger  = ratio > 1.5;
  const isWarning = (!isDanger && ratio > 1.3) || ratio < 0.8;

  const ratioColor = isDanger ? "text-red-500" : isWarning ? "text-amber-500" : "text-emerald-500";
  const badgeVariant: "danger" | "warning" | "success" = isDanger ? "danger" : isWarning ? "warning" : "success";
  const statusLabel = isDanger ? "High Risk" : isWarning ? (ratio < 0.8 ? "Under-trained" : "Elevated") : "Optimal";

  // Position pointer: clamp ratio 0–2.5 to 0–100%
  const pointerPct = Math.min(95, Math.max(5, (ratio / 2.5) * 100));

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Acute:Chronic Workload Ratio
        </h3>
        <Badge variant={badgeVariant}>{statusLabel}</Badge>
      </div>

      <div className="flex items-end gap-4">
        <p className={cn("text-4xl font-bold tabular-nums font-heading", ratioColor)}>
          <AnimatedNumber value={ratio} decimals={2} />
        </p>
        <div className="pb-1 space-y-0.5">
          <p className="text-xs text-muted">
            Acute <span className="font-semibold text-[var(--foreground)]">{acute}</span> RPE
            <span className="mx-1.5">·</span>
            {sessionsInAcute} sessions (7d)
          </p>
          <p className="text-xs text-muted">
            Chronic <span className="font-semibold text-[var(--foreground)]">{chronic}</span> RPE
            <span className="mx-1.5">·</span>
            {sessionsInChronic} sessions (28d)
          </p>
        </div>
      </div>

      {/* Zone bar */}
      <div className="space-y-1.5">
        <div className="relative h-2.5 rounded-full overflow-hidden flex">
          {/* Danger low */}
          <div className="h-full bg-red-200 dark:bg-red-900/50"  style={{ width: "32%" }} />
          {/* Warning low */}
          <div className="h-full bg-amber-200 dark:bg-amber-900/50" style={{ width: "4%" }} />
          {/* Optimal */}
          <div className="h-full bg-emerald-200 dark:bg-emerald-900/50" style={{ width: "20%" }} />
          {/* Warning high */}
          <div className="h-full bg-amber-200 dark:bg-amber-900/50" style={{ width: "8%" }} />
          {/* Danger high */}
          <div className="h-full bg-red-200 dark:bg-red-900/50"  style={{ width: "36%" }} />
          {/* Pointer */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--foreground)] rounded-full"
            style={{ left: `${pointerPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted">
          <span>0.0</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">0.8 – 1.3 optimal</span>
          <span>2.5</span>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  athlete,
  acwr,
  recentPRs,
  bondarchukType,
  lastAssessmentDate,
}: {
  athlete: AthleteProfile;
  acwr: AthleteACWR;
  recentPRs: ThrowLogItem[];
  bondarchukType: string | null;
  lastAssessmentDate: string | null;
}) {
  const infoRows = [
    { label: "Age",        value: calcAge(athlete.dateOfBirth) },
    { label: "Gender",     value: athlete.gender ? athlete.gender.charAt(0) + athlete.gender.slice(1).toLowerCase() : "—" },
    { label: "Height",     value: athlete.heightCm   ? `${athlete.heightCm} cm`   : "—" },
    { label: "Weight",     value: athlete.weightKg   ? `${athlete.weightKg} kg`   : "—" },
    { label: "Email",      value: athlete.user.email },
    { label: "Joined",     value: formatDate(athlete.user.createdAt.toISOString()) },
    { label: "Best Streak",value: athlete.longestStreak > 0 ? `${athlete.longestStreak} days` : "—" },
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-6 pt-6">
      {/* Left: Athlete Details */}
      <div className="space-y-4">
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Athlete Info
          </h3>
          <dl className="space-y-3">
            {infoRows.map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <dt className="text-xs text-muted shrink-0 w-20">{label}</dt>
                <dd className="text-xs font-medium text-[var(--foreground)] text-right truncate">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Bondarchuk Assessment Card */}
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Bondarchuk Assessment
          </h3>
          {bondarchukType ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={BONDARCHUK_COLORS[bondarchukType] ?? "neutral"}>
                  {bondarchukType.replace(/_/g, " ")}
                </Badge>
              </div>
              {lastAssessmentDate && (
                <p className="text-xs text-muted">
                  Last assessed {formatDate(lastAssessmentDate)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted">No assessment yet</p>
          )}
          <Link
            href={`/coach/throws/assessment/${athlete.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
          >
            {bondarchukType ? "Re-assess Athlete" : "Run Assessment"} →
          </Link>
        </div>

      </div>

      {/* Right: ACWR + Recent PRs */}
      <div className="lg:col-span-2 space-y-6">
        {acwr ? (
          <ACWRGauge acwr={acwr} />
        ) : (
          <div className="card p-5 space-y-2">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Acute:Chronic Workload Ratio
            </h3>
            <p className="text-sm text-muted">
              Not enough session data. At least one completed session with RPE in the last 28 days is required.
            </p>
          </div>
        )}

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Recent Personal Bests
            </h3>
            <Link
              href="#throws"
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              View all throws →
            </Link>
          </div>
          {recentPRs.length === 0 ? (
            <EmptyState
              compact
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="7" />
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                </svg>
              }
              title="No personal bests yet"
              description="PRs will appear here once throw marks are logged."
            />
          ) : (
            <div className="space-y-0.5">
              {recentPRs.map((pr) => (
                <div
                  key={pr.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 text-base">
                    🏆
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)] tabular-nums">
                      {pr.distance.toFixed(2)}m
                    </p>
                    <p className="text-xs text-muted">
                      {formatEventName(pr.event)} · {formatImplementWeight(pr.implementWeight)}
                    </p>
                  </div>
                  <p className="text-xs text-muted tabular-nums shrink-0">
                    {formatShortDate(pr.date)}
                  </p>
                  {pr.isCompetition && (
                    <Badge variant="primary">Comp</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Training Tab ───────────────────────────────────────────────────────── */

const SESSION_STATUS: Record<string, { label: string; variant: "success" | "danger" | "warning" | "neutral" }> = {
  COMPLETED:   { label: "Completed",  variant: "success"  },
  SKIPPED:     { label: "Skipped",    variant: "danger"   },
  IN_PROGRESS: { label: "In Progress",variant: "warning"  },
  SCHEDULED:   { label: "Scheduled",  variant: "neutral"  },
};

function TrainingTab({ sessions }: { sessions: SessionItem[] }) {
  return (
    <div className="pt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
          Sessions
        </h2>
        <p className="text-xs text-muted">{sessions.length} sessions</p>
      </div>

      {sessions.length === 0 ? (
        <div className="card">
          <EmptyState
            compact
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            }
            title="No training sessions yet"
            description="Prescribe a session to get started."
          />
        </div>
      ) : (
        <div className="card divide-y divide-[var(--card-border)]">
          {sessions.map((s) => {
            const status = SESSION_STATUS[s.status] ?? { label: s.status, variant: "neutral" as const };
            return (
              <div key={s.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                      {s.planName && (
                        <span className="text-xs text-muted">{s.planName}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-xs text-muted tabular-nums">
                      <span>{formatDate(s.scheduledDate)}</span>
                      {s.completedDate && (
                        <span>Completed {formatShortDate(s.completedDate)}</span>
                      )}
                      {s.rpe != null && (
                        <span className="font-semibold text-[var(--foreground)]">
                          RPE {s.rpe.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {s.notes && (
                      <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2">
                        {s.notes}
                      </p>
                    )}
                    {s.coachNotes && (
                      <p className="text-xs text-primary-600 dark:text-primary-400 line-clamp-1">
                        Coach note: {s.coachNotes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Throws Tab ─────────────────────────────────────────────────────────── */

function ThrowsTab({ throws }: { throws: ThrowLogItem[] }) {
  // Compute per-event summary
  const eventMap = throws.reduce<Record<string, { count: number; best: number }>>((acc, t) => {
    if (!acc[t.event]) acc[t.event] = { count: 0, best: 0 };
    acc[t.event].count++;
    if (t.distance > acc[t.event].best) acc[t.event].best = t.distance;
    return acc;
  }, {});

  const events = Object.entries(eventMap);

  return (
    <div className="pt-6 space-y-6">
      {/* Per-event summary */}
      {events.length > 0 && (
        <div className={cn(
          "grid gap-3",
          events.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"
        )}>
          {events.map(([event, { count, best }]) => (
            <div key={event} className="card px-4 py-3 space-y-0.5">
              <p className="text-xs text-muted">{formatEventName(event)}</p>
              <p className="text-xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                <AnimatedNumber value={best} decimals={2} />m
              </p>
              <p className="text-[11px] text-muted">
                Best · {count} {count === 1 ? "throw" : "throws"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Log table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Throw Log
          </h2>
          <p className="text-xs text-muted">{throws.length} throws</p>
        </div>

        {throws.length === 0 ? (
          <div className="card">
            <EmptyState
              compact
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              }
              title="No throw logs yet"
              description="Throws will appear here once sessions are completed."
            />
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    {[
                      { label: "Date",      align: "left",  hide: false, w: ""     },
                      { label: "Event",     align: "left",  hide: false, w: ""     },
                      { label: "Implement", align: "right", hide: true,  w: ""     },
                      { label: "Distance",  align: "right", hide: false, w: ""     },
                      { label: "",          align: "right", hide: false, w: "w-24" },
                    ].map(({ label, align, hide, w }, i) => (
                      <th
                        key={i}
                        className={cn(
                          "px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider",
                          align === "right" ? "text-right" : "text-left",
                          w,
                          hide && "hidden sm:table-cell"
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {throws.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                        {formatShortDate(t.date)}
                      </td>
                      <td className="px-5 py-3 text-sm text-[var(--foreground)] whitespace-nowrap">
                        {formatEventName(t.event)}
                      </td>
                      <td className="hidden sm:table-cell px-5 py-3 text-right text-sm tabular-nums text-muted">
                        {formatImplementWeight(t.implementWeight)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={cn(
                          "text-sm font-semibold tabular-nums",
                          t.isPersonalBest
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-[var(--foreground)]"
                        )}>
                          {t.distance.toFixed(2)}m
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 justify-end">
                          {t.isPersonalBest && (
                            <Badge variant="warning">PR</Badge>
                          )}
                          {t.isCompetition && (
                            <Badge variant="primary">Comp</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Readiness Tab ──────────────────────────────────────────────────────── */

function ReadinessTab({ trend }: { trend: ReadinessTrendPoint[] }) {
  const latest = trend.length > 0 ? trend[trend.length - 1] : null;

  // Alert conditions
  const criticallyLow = latest !== null && latest.overallScore < 5;
  const consecutive3declining =
    trend.length >= 3 &&
    trend[trend.length - 3].overallScore > trend[trend.length - 2].overallScore &&
    trend[trend.length - 2].overallScore > trend[trend.length - 1].overallScore;

  const chartData: LineChartDataPoint[] = trend.map((p) => ({
    label: formatShortDate(p.date),
    value: p.overallScore,
  }));

  const sleepData: LineChartDataPoint[]    = trend.map((p) => ({ label: formatShortDate(p.date), value: p.sleepQuality }));
  const sorenessData: LineChartDataPoint[] = trend.map((p) => ({ label: formatShortDate(p.date), value: p.soreness }));
  const stressData: LineChartDataPoint[]   = trend.map((p) => ({ label: formatShortDate(p.date), value: p.stressLevel }));
  const energyData: LineChartDataPoint[]   = trend.map((p) => ({ label: formatShortDate(p.date), value: p.energyMood }));

  const metrics = latest
    ? [
        { label: "Overall",       value: latest.overallScore     },
        { label: "Sleep Quality", value: latest.sleepQuality     },
        { label: "Energy & Mood", value: latest.energyMood       },
        { label: "Soreness",      value: latest.soreness         },
        { label: "Stress Level",  value: latest.stressLevel      },
      ]
    : [];

  // History: most recent 14 entries, newest first
  const history = [...trend].reverse().slice(0, 14);

  return (
    <div className="pt-6 space-y-6">
      {/* Alerts */}
      {(criticallyLow || consecutive3declining) && (
        <div className="card px-4 py-3 border border-red-500/30 bg-red-500/5 space-y-1">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Readiness Alert
          </p>
          {criticallyLow && (
            <p className="text-sm text-[var(--foreground)]">
              Score is critically low ({latest!.overallScore.toFixed(1)}) — consider adjusting today&apos;s training load.
            </p>
          )}
          {consecutive3declining && (
            <p className="text-sm text-[var(--foreground)]">
              Readiness has declined for 3 consecutive days — check in with this athlete.
            </p>
          )}
        </div>
      )}

      {/* Overall chart */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Overall Readiness — 30 Days
          </h3>
          {latest && (
            <span className={cn(
              "text-sm font-bold tabular-nums",
              latest.overallScore >= 8 ? "text-emerald-500"
              : latest.overallScore >= 5 ? "text-amber-500"
              : "text-red-500"
            )}>
              {latest.overallScore.toFixed(1)} latest
            </span>
          )}
        </div>
        <LineChart
          data={chartData}
          height={180}
          yMin={0}
          yMax={10}
          color="#f59e0b"
          showArea
          emptyMessage="No check-ins in the last 30 days"
        />
      </div>

      {/* Latest check-in breakdown */}
      {latest ? (
        <div className="card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Latest Check-in Breakdown
            </h3>
            <span className="text-xs text-muted">{formatDate(latest.date)}</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {metrics.map(({ label, value }) => {
              const pct = (value / 10) * 100;
              const variant: "success" | "primary" | "danger" =
                value >= 7 ? "success" : value >= 4 ? "primary" : "danger";
              return (
                <ProgressBar
                  key={label}
                  title={label}
                  value={pct}
                  variant={variant}
                  showLabel
                  label={`${value.toFixed(1)}/10`}
                  size="md"
                  animate
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3 border-t border-[var(--card-border)]">
            <div className="text-xs">
              <span className="text-muted">Sleep hours:</span>{" "}
              <span className="font-semibold">{latest.sleepHours}h</span>
            </div>
            <div className="text-xs">
              <span className="text-muted">Hydration:</span>{" "}
              <span className="font-semibold capitalize">
                {latest.hydration.toLowerCase()}
              </span>
            </div>
            <div className="text-xs">
              <span className="text-muted">Injury:</span>{" "}
              <span className={cn(
                "font-semibold",
                latest.injuryStatus === "ACTIVE"     ? "text-red-500"
                : latest.injuryStatus === "MONITORING" ? "text-amber-500"
                : "text-emerald-500"
              )}>
                {latest.injuryStatus === "ACTIVE" ? "Active"
                  : latest.injuryStatus === "MONITORING" ? "Monitoring"
                  : "None"}
              </span>
            </div>
            {latest.sorenessArea && (
              <div className="text-xs">
                <span className="text-muted">Soreness area:</span>{" "}
                <span className="font-semibold capitalize">{latest.sorenessArea.replace(/_/g, " ")}</span>
              </div>
            )}
            {latest.injuryNotes && (
              <div className="text-xs w-full">
                <span className="text-muted">Injury notes:</span>{" "}
                <span className="text-[var(--foreground)]">{latest.injuryNotes}</span>
              </div>
            )}
            {latest.notes && (
              <div className="text-xs w-full">
                <span className="text-muted">Notes:</span>{" "}
                <span className="text-[var(--foreground)]">{latest.notes}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            compact
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            }
            title="No readiness check-ins yet"
            description="Once this athlete submits wellness check-ins, their readiness data will appear here."
          />
        </div>
      )}

      {/* Per-factor trend charts */}
      {trend.length > 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Factor Trends — 30 Days
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {([
              { label: "Sleep Quality", data: sleepData,    color: "#3b82f6" },
              { label: "Soreness",      data: sorenessData, color: "#f59e0b" },
              { label: "Stress Level",  data: stressData,   color: "#8b5cf6" },
              { label: "Energy & Mood", data: energyData,   color: "#10b981" },
            ] as const).map(({ label, data, color }) => (
              <div key={label} className="card p-4 space-y-1">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
                <LineChart
                  data={data}
                  height={90}
                  yMin={0}
                  yMax={10}
                  color={color}
                  showArea={false}
                  showDots={false}
                  gridLines={2}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History table */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Check-in History
          </h3>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                            {[
                      { label: "Date",      hide: false },
                      { label: "Score",     hide: false },
                      { label: "Sleep",     hide: true  },
                      { label: "Soreness",  hide: true  },
                      { label: "Stress",    hide: true  },
                      { label: "Energy",    hide: true  },
                      { label: "Hydration", hide: true  },
                    ].map(({ label, hide }) => (
                      <th key={label} className={cn("px-4 py-2.5 text-left text-[10px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap", hide && "hidden sm:table-cell")}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {history.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatShortDate(p.date)}</td>
                      <td className="px-4 py-2.5 font-bold tabular-nums">
                        <span className={cn(
                          p.overallScore >= 8 ? "text-emerald-600 dark:text-emerald-400"
                          : p.overallScore >= 5 ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                        )}>
                          {p.overallScore.toFixed(1)}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-xs tabular-nums">{p.sleepQuality}/10</td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-xs tabular-nums">{p.soreness}/10</td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-xs tabular-nums">{p.stressLevel}/10</td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-xs tabular-nums">{p.energyMood}/10</td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-xs capitalize">{p.hydration.toLowerCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Wellness Tab ───────────────────────────────────────────────────────── */

function WellnessTab({ trend }: { trend: ReadinessTrendPoint[] }) {
  const avgOf = (key: "sleepQuality" | "energyMood" | "sleepHours" | "soreness" | "stressLevel"): string => {
    if (trend.length === 0) return "—";
    const total = trend.reduce((s, p) => s + p[key], 0);
    return (total / trend.length).toFixed(1);
  };

  const summaryCards = [
    { label: "Sleep Quality", value: avgOf("sleepQuality"), color: "text-blue-500" },
    { label: "Energy & Mood", value: avgOf("energyMood"),   color: "text-emerald-500" },
    { label: "Avg Sleep",     value: `${avgOf("sleepHours")}h`, color: "text-indigo-500" },
    { label: "Soreness",      value: avgOf("soreness"),     color: "text-amber-500",  note: "lower = better" },
  ];

  const sleepData:     LineChartDataPoint[] = trend.map((p) => ({ label: formatShortDate(p.date), value: p.sleepQuality }));
  const energyData:    LineChartDataPoint[] = trend.map((p) => ({ label: formatShortDate(p.date), value: p.energyMood }));
  const composureData: LineChartDataPoint[] = trend.map((p) => ({ label: formatShortDate(p.date), value: 10 - p.stressLevel }));

  return (
    <div className="pt-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map(({ label, value, color, note }) => {
          const numericPart = parseFloat(value);
          const suffix = value.replace(String(numericPart), "");
          return (
          <div key={label} className="card px-4 py-3 space-y-0.5">
            <p className="text-xs text-muted">{label}</p>
            <p className={cn("text-2xl font-bold font-heading tabular-nums", color)}>
              {!isNaN(numericPart) ? (
                <><AnimatedNumber value={numericPart} decimals={1} />{suffix}</>
              ) : value}
            </p>
            <p className="text-[11px] text-muted">{note ?? "30-day avg"}</p>
          </div>
          );
        })}
      </div>

      {/* Multi-series chart */}
      {trend.length > 0 ? (
        <>
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Wellness Trends — 30 Days
              </h3>
              <div className="flex gap-4">
                {[
                  { label: "Sleep",     color: "#3b82f6" },
                  { label: "Energy",    color: "#10b981" },
                  { label: "Composure", color: "#8b5cf6" },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5 text-xs text-muted">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: l.color }}
                    />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
            <LineChart
              series={[
                { data: sleepData,     color: "#3b82f6", label: "Sleep Quality" },
                { data: energyData,    color: "#10b981", label: "Energy & Mood" },
                { data: composureData, color: "#8b5cf6", label: "Composure" },
              ]}
              height={220}
              yMin={0}
              yMax={10}
              showArea={false}
              emptyMessage="No data available"
            />
          </div>

          {/* Injury history heatmap */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Injury Status — Last {trend.length} Check-ins
            </h3>
            <div className="flex flex-wrap gap-1">
              {trend.map((p) => {
                const bg =
                  p.injuryStatus === "ACTIVE"
                    ? "bg-red-500"
                    : p.injuryStatus === "MONITORING"
                    ? "bg-amber-400"
                    : "bg-emerald-400";
                return (
                  <div
                    key={p.date}
                    title={`${formatShortDate(p.date)}: ${p.injuryStatus.toLowerCase()}`}
                    className={cn("w-5 h-5 rounded cursor-default", bg)}
                  />
                );
              })}
            </div>
            <div className="flex gap-5 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-400" /> Clear
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-400" /> Monitoring
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500" /> Active
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            compact
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
            title="No wellness data yet"
            description="Wellness trends will populate once check-ins are submitted."
          />
        </div>
      )}
    </div>
  );
}

/* ─── Goals Tab ──────────────────────────────────────────────────────────── */

const GOAL_STATUS: Record<string, { label: string; variant: "success" | "danger" | "primary" | "neutral" }> = {
  ACTIVE:    { label: "Active",    variant: "primary" },
  COMPLETED: { label: "Completed", variant: "success" },
  ABANDONED: { label: "Abandoned", variant: "neutral" },
};

function GoalCard({ goal }: { goal: GoalItem }) {
  const status = GOAL_STATUS[goal.status] ?? { label: goal.status, variant: "neutral" as const };
  const progressVariant: "success" | "danger" | "primary" =
    goal.status === "COMPLETED" ? "success" : goal.status === "ABANDONED" ? "danger" : "primary";

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[var(--foreground)]">{goal.title}</p>
            {goal.event && (
              <Badge variant="neutral">
                {formatEventName(goal.event)}
              </Badge>
            )}
          </div>
          {goal.description && (
            <p className="text-xs text-muted line-clamp-2">{goal.description}</p>
          )}
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <ProgressBar
        value={goal.progressPct}
        variant={progressVariant}
        showLabel
        label={`${goal.currentValue.toFixed(2)} / ${goal.targetValue.toFixed(2)} ${goal.unit}`}
        size="md"
        animate
      />

      {goal.deadline && (
        <p className="text-xs text-muted">
          Deadline: {formatDate(goal.deadline)}
        </p>
      )}
    </div>
  );
}

function GoalsTab({ goals }: { goals: GoalItem[] }) {
  const active = goals.filter((g) => g.status === "ACTIVE");
  const completed = goals.filter((g) => g.status !== "ACTIVE");

  return (
    <div className="pt-6 space-y-6">
      {goals.length === 0 ? (
        <div className="card">
          <EmptyState
            compact
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="22" y1="12" x2="18" y2="12" />
                <line x1="6" y1="12" x2="2" y2="12" />
                <line x1="12" y1="6" x2="12" y2="2" />
                <line x1="12" y1="22" x2="12" y2="18" />
              </svg>
            }
            title="No goals set yet"
            description="Set performance targets to track progress over time."
          />
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Active Goals
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold">
                  {active.length}
                </span>
              </h2>
              {active.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Past Goals
              </h2>
              {completed.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function AthleteProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const { coach } = await requireCoachSession();

  const athlete = await getAthleteFull(params.id, coach.id);
  if (!athlete) notFound();

  // Backwards compat: ?tab=X → scroll to #X via SectionNav
  const initialSection = VALID_SECTIONS.includes(searchParams.tab ?? "")
    ? searchParams.tab!
    : undefined;

  // Fetch ALL section data in parallel (single scrollable page — everything visible)
  const results = await Promise.allSettled([
    getAthleteACWR(athlete.id),
    getAthleteRecentPRs(athlete.id, 5),
    getAthleteSessions(athlete.id, 25),
    getAthleteThrowHistory(athlete.id),
    getAthleteReadinessTrend(athlete.id, 30),
    getAthleteGoals(athlete.id),
    getLatestBondarchukAssessment(athlete.id),
  ]);

  const acwr = results[0].status === "fulfilled" ? results[0].value as AthleteACWR : null as AthleteACWR;
  const recentPRs = results[1].status === "fulfilled" ? results[1].value as ThrowLogItem[] : [] as ThrowLogItem[];
  const sessions = results[2].status === "fulfilled" ? results[2].value as SessionItem[] : [] as SessionItem[];
  const throws = results[3].status === "fulfilled" ? results[3].value as ThrowLogItem[] : [] as ThrowLogItem[];
  const trend = results[4].status === "fulfilled" ? results[4].value as ReadinessTrendPoint[] : [] as ReadinessTrendPoint[];
  const goals = results[5].status === "fulfilled" ? results[5].value as GoalItem[] : [] as GoalItem[];
  const latestAssessment = results[6].status === "fulfilled" ? results[6].value : null;

  const bondarchukType = latestAssessment?.athleteType ?? null;
  const lastAssessmentDate = latestAssessment?.completedAt ?? null;

  const latestReadiness = trend.length > 0 ? trend[trend.length - 1] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 lg:pr-28">
      <ScrollProgressBar />
      {/* Decision Hero */}
      <DecisionHero
        athlete={athlete}
        bondarchukType={bondarchukType}
        acwr={acwr}
        latestReadiness={latestReadiness}
      />

      {/* Floating section nav (desktop only) */}
      <SectionNav initialSection={initialSection} />

      {/* All sections — single scrollable page */}
      <section id="overview" className="scroll-mt-20">
        <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">Overview</h2>
        <OverviewTab athlete={athlete} acwr={acwr} recentPRs={recentPRs} bondarchukType={bondarchukType} lastAssessmentDate={lastAssessmentDate} />
      </section>

      <section id="training" className="scroll-mt-20 border-t border-[var(--card-border)] pt-8 mt-8">
        <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">Training</h2>
        <TrainingTab sessions={sessions} />
      </section>

      <section id="throws" className="scroll-mt-20 border-t border-[var(--card-border)] pt-8 mt-8">
        <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">Throws</h2>
        <ThrowsTab throws={throws} />
      </section>

      <section id="readiness" className="scroll-mt-20 border-t border-[var(--card-border)] pt-8 mt-8">
        <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">Readiness</h2>
        <ReadinessTab trend={trend} />
      </section>

      <section id="wellness" className="scroll-mt-20 border-t border-[var(--card-border)] pt-8 mt-8">
        <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">Wellness</h2>
        <WellnessTab trend={trend} />
      </section>

      <section id="goals" className="scroll-mt-20 border-t border-[var(--card-border)] pt-8 mt-8">
        <h2 className="text-lg font-bold font-heading text-[var(--foreground)]">Goals</h2>
        <GoalsTab goals={goals} />
      </section>
    </div>
  );
}
