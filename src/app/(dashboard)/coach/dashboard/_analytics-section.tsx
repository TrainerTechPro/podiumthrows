"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components";
import { TrendingUp, Target, Heart } from "lucide-react";
import type { TeamDistanceDelta, WeeklyVolume, SeasonGainEntry } from "@/lib/data/dashboard-intel";
import { AnalyticsPeriodSelector } from "./_analytics-period-selector";
import { VolumeChart } from "./_volume-chart";
import { SeasonGains } from "./_season-gains";

interface AnalyticsSectionProps {
  period: number;
  distanceDelta: TeamDistanceDelta;
  complianceRate: number | null;
  avgReadiness: number;
  readinessTrend: "up" | "down" | "flat";
  weeklyVolume: WeeklyVolume;
  seasonGains: SeasonGainEntry[];
}

function deltaDirection(val: number): "up" | "down" | "flat" {
  if (val > 0.05) return "up";
  if (val < -0.05) return "down";
  return "flat";
}

function MobileAnalyticsBrief({
  period,
  distanceDelta,
  complianceRate,
  avgReadiness,
  readinessTrend,
}: Pick<
  AnalyticsSectionProps,
  "period" | "distanceDelta" | "complianceRate" | "avgReadiness" | "readinessTrend"
>) {
  const hasDelta = distanceDelta.athleteCount > 0;
  const deltaVal = hasDelta ? Number(distanceDelta.avgDeltaPercent.toFixed(1)) : 0;
  const deltaIsUp = deltaVal > 0;
  const deltaIsDown = deltaVal < 0;
  const compliance = complianceRate ?? 0;
  const readinessLabel =
    avgReadiness <= 0
      ? "No readiness baseline"
      : readinessTrend === "up"
        ? "Readiness rising"
        : readinessTrend === "down"
          ? "Readiness falling"
          : "Readiness stable";
  const headline = !hasDelta
    ? "Build the comparison set."
    : deltaIsUp
      ? "Team distance is moving up."
      : deltaIsDown
        ? "Team distance is sliding."
        : "Team distance is holding.";

  return (
    <div className="sm:hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-nano font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Team signal
          </p>
          <h3 className="mt-1 font-heading text-section font-semibold leading-[1.15] text-[var(--foreground)]">
            {headline}
          </h3>
        </div>
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
            deltaIsDown
              ? "bg-danger-500/10 text-danger-500"
              : deltaIsUp
                ? "bg-success-500/10 text-success-500"
                : "bg-primary-500/10 text-primary-500"
          )}
        >
          <TrendingUp className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MobileMetric
          icon={<TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />}
          label={`${period}d marks`}
          value={hasDelta ? `${deltaVal >= 0 ? "+" : ""}${Math.abs(deltaVal).toFixed(1)}%` : "—"}
          tone={deltaIsDown ? "danger" : deltaIsUp ? "success" : "neutral"}
        />
        <MobileMetric
          icon={<Target className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />}
          label="Compliance"
          value={`${Math.round(compliance)}%`}
          tone={compliance >= 80 ? "success" : compliance >= 60 ? "warning" : "danger"}
        />
        <MobileMetric
          icon={<Heart className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />}
          label="Ready"
          value={avgReadiness > 0 ? avgReadiness.toFixed(1) : "—"}
          tone={avgReadiness >= 7 ? "success" : avgReadiness >= 5 ? "warning" : "danger"}
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        {hasDelta
          ? `${distanceDelta.athleteCount} of ${distanceDelta.totalAthletes} athletes have comparison marks. ${readinessLabel.toLowerCase()}.`
          : "Repeat marks are needed before distance movement is meaningful. Keep readiness and compliance visible until then."}
      </p>
    </div>
  );
}

function MobileMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "text-success-500"
      : tone === "warning"
        ? "text-warning-500"
        : tone === "danger"
          ? "text-danger-500"
          : "text-[var(--foreground)]";

  return (
    <div className="min-w-0 px-1 py-2">
      <div className="flex items-center gap-1.5 text-[var(--muted)]">
        {icon}
        <p className="truncate text-nano font-semibold uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className={cn("mt-2 truncate font-mono text-lg font-semibold tabular-nums", toneClass)}>
        {value}
      </p>
    </div>
  );
}

export function AnalyticsSection({
  period,
  distanceDelta,
  complianceRate,
  avgReadiness,
  readinessTrend,
  weeklyVolume,
  seasonGains,
}: AnalyticsSectionProps) {
  const hasDelta = distanceDelta.athleteCount > 0;
  const deltaVal = hasDelta ? Number(distanceDelta.avgDeltaPercent.toFixed(1)) : 0;

  return (
    <section className="space-y-5">
      {/* Period selector — the parent <SectionHeader title="Analytics"> already names the section */}
      <div className="flex justify-end">
        <AnalyticsPeriodSelector period={period} />
      </div>

      <MobileAnalyticsBrief
        period={period}
        distanceDelta={distanceDelta}
        complianceRate={complianceRate}
        avgReadiness={avgReadiness}
        readinessTrend={readinessTrend}
      />

      {/* Stat cards — full grid once there is enough width for labels and values */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        {/* Distance Delta */}
        <StatCard
          label="Distance Δ"
          value={
            hasDelta ? (
              <span
                className={cn(
                  deltaVal > 0
                    ? "text-success-500"
                    : deltaVal < 0
                      ? "text-danger-500"
                      : "text-[var(--foreground)]"
                )}
              >
                {deltaVal >= 0 ? "+" : ""}
                {Math.abs(deltaVal).toFixed(1)}%
              </span>
            ) : (
              <span className="text-surface-400">—</span>
            )
          }
          animate={false}
          accent={deltaVal > 0 ? "success" : deltaVal < 0 ? "danger" : "none"}
          icon={<TrendingUp size={16} strokeWidth={1.75} aria-hidden="true" />}
          trend={
            hasDelta
              ? {
                  direction: deltaDirection(distanceDelta.avgDeltaPercent),
                  value: `${distanceDelta.athleteCount} of ${distanceDelta.totalAthletes} athletes`,
                  positiveIsUp: true,
                }
              : undefined
          }
          note={!hasDelta ? "no comparison data" : undefined}
        />

        {/* Compliance Rate */}
        <StatCard
          label="Compliance"
          value={complianceRate ?? 0}
          unit="%"
          decimals={0}
          accent={
            (complianceRate ?? 0) >= 80
              ? "success"
              : (complianceRate ?? 0) >= 60
                ? "warning"
                : "danger"
          }
          icon={<Target size={16} strokeWidth={1.75} aria-hidden="true" />}
          note="30-day sessions"
        />

        {/* Avg Readiness */}
        <StatCard
          label="Avg Readiness"
          value={avgReadiness > 0 ? Number(avgReadiness.toFixed(1)) : 0}
          unit="/ 10"
          decimals={1}
          accent={
            avgReadiness >= 7
              ? "success"
              : avgReadiness >= 5
                ? "warning"
                : avgReadiness > 0
                  ? "danger"
                  : "none"
          }
          icon={<Heart size={16} strokeWidth={1.75} aria-hidden="true" />}
          trend={
            avgReadiness > 0
              ? {
                  direction: readinessTrend,
                  value:
                    readinessTrend === "up"
                      ? "trending up"
                      : readinessTrend === "down"
                        ? "trending down"
                        : "stable",
                  positiveIsUp: true,
                }
              : undefined
          }
        />
      </div>

      {/* Chart + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <VolumeChart data={weeklyVolume} />
        </div>
        <div className="lg:col-span-2">
          <SeasonGains entries={seasonGains} period={period} />
        </div>
      </div>
    </section>
  );
}
