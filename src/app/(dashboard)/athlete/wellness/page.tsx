import { Activity, Heart, Thermometer, Droplets, Zap, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  requireAthleteSession,
  getAthleteCheckInHistory,
  getAthleteCheckInToday,
  type ReadinessCheckInItem,
} from "@/lib/data/athlete";
import { parseSorenessArea } from "@/lib/readiness/parse-soreness";
import { getAthleteReadinessTrend, type ReadinessTrendPoint } from "@/lib/data/coach";
import { getTodaySnapshot } from "@/lib/whoop/sync";
import { getTodaySnapshot as getOuraTodaySnapshot } from "@/lib/oura/sync";
import { CheckinFlow } from "./_checkin-flow";
import { ReadinessChart } from "./_readiness-chart";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

// Reads a finite number from a JSON blob's top-level field. Returns null for
// any non-object root or non-numeric value. Used to extract athlete lifestyle
// baselines without pulling the full profile-types module into wellness.
function readJsonNumber(json: unknown, key: string): number | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const v = (json as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-success-600 dark:text-success-400";
  if (score >= 5) return "text-primary-600 dark:text-primary-400";
  return "text-danger-600 dark:text-danger-400";
}

function scoreDot(score: number): string {
  if (score >= 8) return "bg-success-500";
  if (score >= 5) return "bg-primary-500";
  return "bg-danger-500";
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-success-500/10 border-success-500/20";
  if (score >= 5) return "bg-primary-500/10 border-primary-500/20";
  return "bg-danger-500/10 border-danger-500/20";
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
  // Soreness slider: 1 = "No soreness", 10 = extreme. Higher score = worse
  // recovery, so the "elevated soreness" insight fires when today's value
  // is higher than the recent average, not lower.
  if (today.soreness > avgSoreness + 1.5)
    insights.push("Higher soreness than usual. Consider a lighter session or active recovery.");
  if (today.energyMood < avgEnergy - 1.5)
    insights.push("Energy is dipping. Stay well-hydrated and check in with your coach.");
  // Stress slider: 1 = Overwhelmed, 10 = Totally relaxed. Lower score =
  // more stressed, so the check stays `< avg - 1.5`.
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

/* ─── Oura / Device Helpers ──────────────────────────────────────────────── */

/** Oura uses 0-100. Returns a status label matching Oura's own UI. */
function ouraLabel(score: number): string {
  if (score >= 85) return "Optimal";
  if (score >= 70) return "Good";
  if (score >= 60) return "Pay Attention";
  return "Take It Easy";
}

function ouraScoreColor(score: number): string {
  if (score >= 85) return "text-success-600 dark:text-success-400";
  if (score >= 70) return "text-info-600 dark:text-info-400";
  if (score >= 60) return "text-primary-600 dark:text-primary-400";
  return "text-danger-600 dark:text-danger-400";
}

function ouraBarColor(score: number): string {
  if (score >= 85) return "bg-success-500";
  if (score >= 70) return "bg-info-500";
  if (score >= 60) return "bg-primary-500";
  return "bg-danger-500";
}

function formatSleepDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function hasDeviceData(checkIn: ReadinessCheckInItem): boolean {
  return checkIn.source === "OURA_AUTO" || checkIn.source === "WHOOP_AUTO";
}

/* ─── Device Vitals Card ─────────────────────────────────────────────────── */

function DeviceVitalsCard({ checkIn }: { checkIn: ReadinessCheckInItem }) {
  const isOura = checkIn.source === "OURA_AUTO";
  const vitals: { label: string; value: string; icon: typeof Heart; color: string }[] = [];

  if (checkIn.hrvMs != null) {
    vitals.push({
      label: "HRV",
      value: `${Math.round(checkIn.hrvMs)} ms`,
      icon: Activity,
      color: "text-info-500",
    });
  }
  if (checkIn.restingHR != null) {
    vitals.push({
      label: "Resting HR",
      value: `${Math.round(checkIn.restingHR)} bpm`,
      icon: Heart,
      color: "text-danger-500",
    });
  }
  if (checkIn.spo2 != null) {
    vitals.push({
      label: "SpO2",
      value: `${checkIn.spo2.toFixed(1)}%`,
      icon: Droplets,
      color: "text-info-500",
    });
  }
  if (isOura && checkIn.temperatureDeviation != null) {
    const sign = checkIn.temperatureDeviation >= 0 ? "+" : "";
    vitals.push({
      label: "Temp Dev",
      value: `${sign}${checkIn.temperatureDeviation.toFixed(1)}\u00B0C`,
      icon: Thermometer,
      color:
        checkIn.temperatureDeviation > 0.5
          ? "text-danger-500"
          : checkIn.temperatureDeviation < -0.5
            ? "text-info-500"
            : "text-success-500",
    });
  }
  if (!isOura && checkIn.whoopStrain != null) {
    vitals.push({
      label: "Strain",
      value: checkIn.whoopStrain.toFixed(1),
      icon: Zap,
      color: "text-primary-500",
    });
  }

  if (vitals.length === 0) return null;

  return (
    <div className="card px-5 py-4 space-y-3">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Biometrics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {vitals.map((v) => {
          const Icon = v.icon;
          return (
            <div key={v.label} className="text-center space-y-1">
              <Icon
                size={16}
                strokeWidth={1.75}
                className={cn(v.color, "mx-auto")}
                aria-hidden="true"
              />
              <p className="text-lg font-bold font-heading tabular-nums text-[var(--foreground)]">
                {v.value}
              </p>
              <p className="text-nano text-muted uppercase tracking-wider">{v.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const isOura = checkIn.source === "OURA_AUTO";
  const isDevice = hasDeviceData(checkIn);

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

  // If Oura, show actual 0-100 scores
  const ouraReadiness = isOura ? checkIn.ouraReadiness : null;
  const ouraSleep = isOura ? checkIn.ouraSleepScore : null;
  const ouraActivity = isOura ? checkIn.ouraActivityScore : null;

  const sorenessAreaParsed = parseSorenessArea(checkIn.sorenessArea ?? null);

  const factors = [
    { label: "Sleep", value: checkIn.sleepQuality, hint: formatSleepDuration(checkIn.sleepHours) },
    {
      label: "Soreness",
      value: checkIn.soreness,
      hint: sorenessAreaParsed.legacyText?.replace(/_/g, " ") ?? undefined,
      sorenessAreas: sorenessAreaParsed.isStructured ? sorenessAreaParsed.areas : [],
    },
    { label: "Stress", value: checkIn.stressLevel, hint: undefined, sorenessAreas: [] },
    { label: "Energy", value: checkIn.energyMood, hint: undefined, sorenessAreas: [] },
  ];

  return (
    <div className="space-y-5">
      {/* Device source badge */}
      {isDevice && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-100 dark:bg-surface-800 text-xs font-medium text-muted rounded-full">
            {isOura ? (
              <>
                <CircleDot
                  size={10}
                  strokeWidth={1.75}
                  className="text-primary-500"
                  aria-hidden="true"
                />{" "}
                Oura Ring
              </>
            ) : (
              <>
                <Zap size={10} strokeWidth={1.75} className="text-primary-500" aria-hidden="true" />{" "}
                WHOOP
              </>
            )}
          </span>
          <span className="text-nano text-muted">Auto-synced</span>
        </div>
      )}

      {/* Oura-style score cards (0-100 scale) — shown when device data is available */}
      {isOura && ouraReadiness != null && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Readiness */}
          <div className={cn("card px-5 py-4 border", scoreBg(checkIn.overallScore))}>
            <p className="text-nano font-semibold text-muted uppercase tracking-wider mb-1">
              Readiness
            </p>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-4xl font-bold font-heading tabular-nums",
                  ouraScoreColor(ouraReadiness)
                )}
              >
                {Math.round(ouraReadiness)}
              </span>
              <span className="text-xs text-muted">/100</span>
            </div>
            <p className={cn("text-xs font-medium mt-1", ouraScoreColor(ouraReadiness))}>
              {ouraLabel(ouraReadiness)}
            </p>
            <div className="mt-2 h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", ouraBarColor(ouraReadiness))}
                style={{ width: `${ouraReadiness}%` }}
              />
            </div>
          </div>

          {/* Sleep */}
          {ouraSleep != null && (
            <div className="card px-5 py-4">
              <p className="text-nano font-semibold text-muted uppercase tracking-wider mb-1">
                Sleep
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-4xl font-bold font-heading tabular-nums",
                    ouraScoreColor(ouraSleep)
                  )}
                >
                  {Math.round(ouraSleep)}
                </span>
                <span className="text-xs text-muted">/100</span>
              </div>
              <p className="text-xs text-muted mt-1">{formatSleepDuration(checkIn.sleepHours)}</p>
              <div className="mt-2 h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", ouraBarColor(ouraSleep))}
                  style={{ width: `${ouraSleep}%` }}
                />
              </div>
            </div>
          )}

          {/* Activity */}
          {ouraActivity != null && (
            <div className="card px-5 py-4">
              <p className="text-nano font-semibold text-muted uppercase tracking-wider mb-1">
                Activity
              </p>
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-4xl font-bold font-heading tabular-nums",
                    ouraScoreColor(Math.min(ouraActivity, 100))
                  )}
                >
                  {Math.round(ouraActivity)}
                </span>
                <span className="text-xs text-muted">/100</span>
              </div>
              <p
                className={cn(
                  "text-xs font-medium mt-1",
                  ouraActivity >= 100 ? "text-success-600 dark:text-success-400" : "text-muted"
                )}
              >
                {ouraActivity >= 100 ? "Goal Reached" : ouraLabel(ouraActivity)}
              </p>
              <div className="mt-2 h-1.5 bg-[var(--card-border)] rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", ouraBarColor(Math.min(ouraActivity, 100)))}
                  style={{ width: `${Math.min(ouraActivity, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mapped readiness score (always shown — this is what the coach sees) */}
      <div className={cn("card px-5 py-5 border", scoreBg(checkIn.overallScore))}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
              {isDevice ? "Mapped Readiness Score" : "Today\u2019s Readiness Score"}
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
            <p className="text-nano text-muted uppercase tracking-wide">Hydration</p>
            <span
              className={cn(
                "inline-block text-xs font-semibold px-2 py-0.5 rounded-full",
                checkIn.hydration === "GOOD"
                  ? "bg-success-500/10 text-success-600 dark:text-success-400"
                  : checkIn.hydration === "ADEQUATE"
                    ? "bg-primary-500/10 text-primary-600 dark:text-primary-400"
                    : "bg-danger-500/10 text-danger-600 dark:text-danger-400"
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
                      ? "bg-danger-500/10 text-danger-600 dark:text-danger-400"
                      : "bg-primary-500/10 text-primary-600 dark:text-primary-400"
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
              <span className="text-success-600 dark:text-success-400 font-medium">
                ↑ Trending up
              </span>
            ) : avg7 < avg14 - 0.3 ? (
              <span className="text-primary-600 dark:text-primary-400 font-medium">
                ↓ Trending down
              </span>
            ) : (
              <span className="text-muted">→ Steady</span>
            )}
          </div>
        )}
      </div>

      {/* Device vitals (HRV, RHR, SpO2, Temp) */}
      {isDevice && <DeviceVitalsCard checkIn={checkIn} />}

      {/* Factor breakdown */}
      <div className="card px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Factor Breakdown
          </h3>
          {isDevice && (
            <span className="text-nano text-muted italic">
              Soreness, Stress, Energy are self-reported defaults
            </span>
          )}
        </div>
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
                    f.value >= 8
                      ? "bg-success-500"
                      : f.value >= 5
                        ? "bg-primary-500"
                        : "bg-danger-500"
                  )}
                  style={{ width: `${f.value * 10}%` }}
                />
              </div>
              {f.sorenessAreas && f.sorenessAreas.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {f.sorenessAreas.map((area) => (
                    <span
                      key={`${area.slug}-${area.side ?? "center"}`}
                      className={cn(
                        "text-nano font-medium px-2 py-0.5 rounded-full border",
                        area.severity === 3
                          ? "bg-danger-500/12 text-danger-400 border-danger-500/20"
                          : area.severity === 2
                            ? "bg-primary-500/12 text-primary-400 border-primary-500/20"
                            : "bg-warning-500/12 text-warning-400 border-warning-500/20"
                      )}
                    >
                      {area.region}
                    </span>
                  ))}
                </div>
              ) : f.hint ? (
                <p className="text-nano text-muted capitalize">{f.hint}</p>
              ) : null}
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
  const { isStructured, areas, legacyText } = parseSorenessArea(c.sorenessArea);

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
        <div>
          <p className="text-nano text-muted uppercase tracking-wide">Sleep</p>
          <p className="text-xs text-[var(--foreground)] font-medium">
            {c.sleepQuality}/10 · {c.sleepHours}h
          </p>
        </div>
        <div>
          <p className="text-nano text-muted uppercase tracking-wide">Soreness</p>
          <p className="text-xs text-[var(--foreground)] font-medium">{c.soreness}/10</p>
          {isStructured && areas.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {areas.map((area) => (
                <span
                  key={`${area.slug}-${area.side ?? "center"}`}
                  className={cn(
                    "text-nano font-medium px-2 py-0.5 rounded-full border",
                    area.severity === 3
                      ? "bg-danger-500/12 text-danger-400 border-danger-500/20"
                      : area.severity === 2
                        ? "bg-primary-500/12 text-primary-400 border-primary-500/20"
                        : "bg-warning-500/12 text-warning-400 border-warning-500/20"
                  )}
                >
                  {area.region}
                </span>
              ))}
            </div>
          ) : legacyText ? (
            <p className="text-nano text-muted capitalize">{legacyText.replace(/_/g, " ")}</p>
          ) : null}
        </div>
        <div>
          <p className="text-nano text-muted uppercase tracking-wide">Stress</p>
          <p className="text-xs text-[var(--foreground)] font-medium">{c.stressLevel}/10</p>
        </div>
        <div>
          <p className="text-nano text-muted uppercase tracking-wide">Energy</p>
          <p className="text-xs text-[var(--foreground)] font-medium">{c.energyMood}/10</p>
        </div>
      </div>
      {c.injuryStatus !== "NONE" && (
        <div className="ml-5 mt-1">
          <span
            className={cn(
              "text-xs font-medium",
              c.injuryStatus === "ACTIVE"
                ? "text-danger-600 dark:text-danger-400"
                : "text-primary-600 dark:text-primary-400"
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
  const { session, athlete } = await requireAthleteSession();

  const [checkInToday, history, trend, whoopSnapshot, ouraSnapshot] = await Promise.all([
    getAthleteCheckInToday(athlete.id),
    getAthleteCheckInHistory(athlete.id, 14),
    getAthleteReadinessTrend(athlete.id, 30),
    getTodaySnapshot(athlete.id),
    getOuraTodaySnapshot(athlete.id),
  ]);

  const chartData = trend.map((t) => ({
    label: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: t.overallScore,
  }));

  // Master Profile lifestyle baselines — used as second-tier prefill below
  // wearable data and above hardcoded defaults. Null when the athlete hasn't
  // filled in their lifestyle section yet.
  const baselineSleepHours = readJsonNumber(athlete.lifestyle, "sleepHours");
  const baselineStress = readJsonNumber(athlete.lifestyle, "stressBaseline");

  // Extract yesterday's average stress+energy score for comparison badge
  const previousScore = (() => {
    if (history.length === 0) return null;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yd = history.find((h) => {
      const d = new Date(h.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === yesterday.getTime();
    });
    if (!yd) return null;
    return (yd.stressLevel + yd.energyMood) / 2;
  })();

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
        <CheckinFlow
          userId={session.userId}
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
          ouraData={
            ouraSnapshot
              ? {
                  readinessScore: ouraSnapshot.readinessScore,
                  hrvMs: ouraSnapshot.hrvMs,
                  restingHR: ouraSnapshot.restingHR,
                  spo2: ouraSnapshot.spo2,
                  sleepScore: ouraSnapshot.sleepScore,
                  sleepDurationSec: ouraSnapshot.sleepDurationSec,
                  activityScore: ouraSnapshot.activityScore,
                }
              : undefined
          }
          previousScore={previousScore}
          baselineSleepHours={baselineSleepHours}
          baselineStress={baselineStress}
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
