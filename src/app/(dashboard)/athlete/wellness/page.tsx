import { cn } from "@/lib/utils";
import {
  requireAthleteSession,
  getAthleteCheckInHistory,
  getAthleteCheckInToday,
  type ReadinessCheckInItem,
} from "@/lib/data/athlete";
import { getAthleteReadinessTrend, type ReadinessTrendPoint } from "@/lib/data/coach";
import { getTodaySnapshot } from "@/lib/whoop/sync";
import { CheckInForm } from "./_checkin-form";
import { ReadinessChart } from "./_readiness-chart";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreDot(score: number): string {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-red-500";
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 5) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function scoreLabel(score: number): string {
  if (score >= 9) return "Excellent";
  if (score >= 8) return "Good";
  if (score >= 6) return "Moderate";
  if (score >= 5) return "Below Average";
  return "Low — Rest Recommended";
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/* ─── Insights Generator ─────────────────────────────────────────────────── */

function buildInsights(today: ReadinessCheckInItem, trend: ReadinessTrendPoint[]): string[] {
  const insights: string[] = [];
  // Use last 7 days (excluding today)
  const recent = trend.slice(-8, -1);
  if (recent.length < 3) return insights;

  const avgSleep = avg(recent.map((p) => p.sleepQuality));
  const avgSoreness = avg(recent.map((p) => p.soreness));
  const avgEnergy = avg(recent.map((p) => p.energyMood));
  const avgStress = avg(recent.map((p) => p.stressLevel));
  const avgScore = avg(recent.map((p) => p.overallScore));

  if (today.sleepQuality < avgSleep - 1.5)
    insights.push("Your sleep quality is below your recent average — prioritise recovery tonight.");
  if (today.soreness < avgSoreness - 1.5)
    insights.push("Higher soreness than usual. Consider a lighter session or active recovery.");
  if (today.energyMood < avgEnergy - 1.5)
    insights.push("Energy is dipping. Stay well-hydrated and check in with your coach.");
  if (today.stressLevel < avgStress - 1.5)
    insights.push("Stress is elevated today. A short mindfulness session may help.");

  // Trend direction
  const last3 = trend.slice(-4, -1);
  if (last3.length === 3) {
    const declining =
      last3[0].overallScore > last3[1].overallScore &&
      last3[1].overallScore > last3[2].overallScore;
    if (declining)
      insights.push(
        "Your readiness has trended down over the last 3 days — flag this with your coach."
      );
  }

  if (today.overallScore >= avgScore + 1.5)
    insights.push("Great day — you're above your recent average. Make the most of it in training.");

  return insights.slice(0, 2);
}

/* ─── Today's Result Card ────────────────────────────────────────────────── */

function TodayResultCard({
  checkIn,
  trend,
}: {
  checkIn: ReadinessCheckInItem;
  trend: ReadinessTrendPoint[];
}) {
  const insights = buildInsights(checkIn, trend);

  // 7-day chart data (up to last 7 entries including today)
  const chartSlice = trend.slice(-7);
  const chartData = chartSlice.map((t) => ({
    label: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: t.overallScore,
  }));

  // 14-day avg vs 7-day avg for comparison
  const older = trend.slice(-14, -7);
  const recent7 = trend.slice(-7, -1); // exclude today
  const avg14 = older.length > 0 ? avg(older.map((p) => p.overallScore)) : null;
  const avg7 = recent7.length > 0 ? avg(recent7.map((p) => p.overallScore)) : null;

  const factors = [
    { label: "Sleep", value: checkIn.sleepQuality, hint: `${checkIn.sleepHours}h slept` },
    {
      label: "Soreness",
      value: checkIn.soreness,
      hint: checkIn.sorenessArea?.replace(/_/g, " ") ?? undefined,
    },
    { label: "Stress", value: checkIn.stressLevel, hint: undefined },
    { label: "Energy", value: checkIn.energyMood, hint: undefined },
  ];

  return (
    <div className="space-y-5">
      {/* Score hero */}
      <div className={cn("card px-5 py-5 border", scoreBg(checkIn.overallScore))}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              Today&apos;s Readiness Score
            </p>
            <p
              className={cn(
                "text-5xl font-bold tabular-nums font-heading",
                scoreColor(checkIn.overallScore)
              )}
            >
              {checkIn.overallScore.toFixed(1)}
            </p>
            <p className={cn("text-sm font-medium mt-1", scoreColor(checkIn.overallScore))}>
              {scoreLabel(checkIn.overallScore)}
            </p>
          </div>

          <div className="text-right space-y-1.5 shrink-0">
            <p className="text-[10px] text-muted uppercase tracking-wide">Hydration</p>
            <span
              className={cn(
                "inline-block text-xs font-semibold px-2 py-0.5 rounded-full",
                checkIn.hydration === "GOOD"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : checkIn.hydration === "ADEQUATE"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
              )}
            >
              {checkIn.hydration.charAt(0) + checkIn.hydration.slice(1).toLowerCase()}
            </span>

            {checkIn.injuryStatus !== "NONE" && (
              <div className="mt-1">
                <span
                  className={cn(
                    "inline-block text-xs font-semibold px-2 py-0.5 rounded-full",
                    checkIn.injuryStatus === "ACTIVE"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  )}
                >
                  {checkIn.injuryStatus === "ACTIVE" ? "Injury Active" : "Monitoring"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 14-day comparison */}
        {avg14 !== null && avg7 !== null && (
          <div className="mt-4 pt-4 border-t border-[var(--card-border)] flex items-center gap-6 text-xs">
            <div>
              <span className="text-muted">7-day avg</span>{" "}
              <span className="font-semibold">{avg7.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-muted">14-day avg</span>{" "}
              <span className="font-semibold">{avg14.toFixed(1)}</span>
            </div>
            {avg7 > avg14 + 0.3 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                ↑ Trending up
              </span>
            ) : avg7 < avg14 - 0.3 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ↓ Trending down
              </span>
            ) : (
              <span className="text-muted">→ Steady</span>
            )}
          </div>
        )}
      </div>

      {/* Factor breakdown */}
      <div className="card px-5 py-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
          Factor Breakdown
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {factors.map((f) => (
            <div key={f.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">{f.label}</p>
                <span className={cn("text-xs font-bold tabular-nums", scoreColor(f.value))}>
                  {f.value}/10
                </span>
              </div>
              <div className="h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    f.value >= 8 ? "bg-emerald-500" : f.value >= 5 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${f.value * 10}%` }}
                />
              </div>
              {f.hint && <p className="text-[10px] text-muted capitalize">{f.hint}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* 7-day trend */}
      {chartData.length > 1 && (
        <div className="card px-4 py-4 space-y-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">7-Day Trend</h3>
          <ReadinessChart data={chartData} />
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className="card px-4 py-3 flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary-500)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-sm text-[var(--foreground)] leading-snug">{insight}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted text-center">
        Come back tomorrow to submit your next check-in.
      </p>
    </div>
  );
}

/* ─── History Card ────────────────────────────────────────────────────────── */

type CheckIn = {
  id: string;
  date: string;
  overallScore: number;
  sleepQuality: number;
  sleepHours: number;
  soreness: number;
  sorenessArea: string | null;
  stressLevel: number;
  energyMood: number;
  hydration: string;
  injuryStatus: string;
  notes: string | null;
};

function CheckInCard({ c }: { c: CheckIn }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn("w-2 h-2 rounded-full shrink-0", scoreDot(c.overallScore))} />
        <p className="text-sm font-medium text-[var(--foreground)]">{formatDate(c.date)}</p>
        <span className={cn("text-sm font-bold tabular-nums ml-auto", scoreColor(c.overallScore))}>
          {c.overallScore.toFixed(1)}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-5">
        {[
          { label: "Sleep", value: `${c.sleepQuality}/10 · ${c.sleepHours}h` },
          {
            label: "Soreness",
            value: `${c.soreness}/10${c.sorenessArea ? ` (${c.sorenessArea.replace(/_/g, " ")})` : ""}`,
          },
          { label: "Stress", value: `${c.stressLevel}/10` },
          { label: "Energy", value: `${c.energyMood}/10` },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-[10px] text-muted uppercase tracking-wide">{item.label}</p>
            <p className="text-xs text-[var(--foreground)] font-medium truncate">{item.value}</p>
          </div>
        ))}
      </div>
      {c.injuryStatus !== "NONE" && (
        <div className="ml-5 mt-1">
          <span
            className={cn(
              "text-xs font-medium",
              c.injuryStatus === "ACTIVE"
                ? "text-red-600 dark:text-red-400"
                : "text-amber-600 dark:text-amber-400"
            )}
          >
            {c.injuryStatus === "ACTIVE" ? "Injury Active" : "Monitoring Injury"}
          </span>
        </div>
      )}
      {c.notes && <p className="ml-5 mt-1 text-xs text-muted italic">{c.notes}</p>}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function WellnessPage() {
  const { athlete } = await requireAthleteSession();

  const [checkInToday, history, trend, whoopSnapshot] = await Promise.all([
    getAthleteCheckInToday(athlete.id),
    getAthleteCheckInHistory(athlete.id, 14),
    getAthleteReadinessTrend(athlete.id, 30),
    getTodaySnapshot(athlete.id),
  ]);

  const chartData = trend.map((t) => ({
    label: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: t.overallScore,
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
          Wellness Check-In
        </h1>
        <p className="text-sm text-muted mt-0.5">
          Daily readiness tracking helps your coach optimise your training load.
        </p>
      </div>

      {checkInToday ? (
        <TodayResultCard checkIn={checkInToday} trend={trend} />
      ) : (
        <CheckInForm
          whoopData={
            whoopSnapshot
              ? {
                  recoveryScore: whoopSnapshot.recoveryScore,
                  hrvMs: whoopSnapshot.hrvMs,
                  restingHR: whoopSnapshot.restingHR,
                  spo2: whoopSnapshot.spo2,
                  sleepPerformance: whoopSnapshot.sleepPerformance,
                  sleepDurationMs: whoopSnapshot.sleepDurationMs,
                  strain: whoopSnapshot.strain,
                }
              : undefined
          }
        />
      )}

      {/* 30-day trend chart — only shown when no check-in today (post-view shows 7-day) */}
      {!checkInToday && chartData.length > 1 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            30-Day Readiness Trend
          </h2>
          <div className="card px-4 py-4">
            <ReadinessChart data={chartData} />
          </div>
        </section>
      )}

      {/* History */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Recent Check-Ins
          </h2>
          <div className="card divide-y divide-[var(--card-border)]">
            {history.map((c) => (
              <CheckInCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
