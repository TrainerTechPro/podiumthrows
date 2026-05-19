"use client";

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

      {/* Stat cards — horizontal scroll on mobile, 3-col grid on sm+ */}
      <div className="flex sm:grid sm:grid-cols-3 gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0 custom-scrollbar">
        {/* Distance Delta */}
        <StatCard
          className="min-w-[220px] snap-start shrink-0 sm:min-w-0 sm:shrink"
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
          className="min-w-[220px] snap-start shrink-0 sm:min-w-0 sm:shrink"
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
          className="min-w-[220px] snap-start shrink-0 sm:min-w-0 sm:shrink"
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
