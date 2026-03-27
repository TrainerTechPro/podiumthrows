import { requireCoachSession, getTeamReadinessDetail } from "@/lib/data/coach";
import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ReadinessGrid } from "./_readiness-grid";

export const metadata = { title: "Team Readiness — Podium Throws" };

function scoreTier(score: number): {
  color: string;
  variant: "success" | "warning" | "danger";
} {
  if (score >= 7) return { color: "text-emerald-500", variant: "success" };
  if (score >= 5) return { color: "text-amber-500", variant: "warning" };
  return { color: "text-red-500", variant: "danger" };
}

export default async function CoachWellnessPage() {
  let coach;
  try {
    ({ coach } = await requireCoachSession());
  } catch {
    redirect("/login");
  }

  const athletes = await getTeamReadinessDetail(coach.id);

  // Compute team-level stats
  const withScores = athletes.filter((a) => a.latestScore !== null);
  const teamAvg =
    withScores.length > 0
      ? withScores.reduce((sum, a) => sum + a.latestScore!, 0) /
        withScores.length
      : 0;
  const teamAvgRounded = Math.round(teamAvg * 10) / 10;

  // Team trend: average of individual trends
  const withTrends = athletes.filter((a) => a.trend !== null);
  const teamTrend =
    withTrends.length > 0
      ? Math.round(
          (withTrends.reduce((sum, a) => sum + a.trend!, 0) /
            withTrends.length) *
            10
        ) / 10
      : null;

  const tier = teamAvgRounded > 0 ? scoreTier(teamAvgRounded) : scoreTier(5);

  return (
    <div className="space-y-4 animate-spring-up">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
          Team Readiness
        </h1>
        <p className="text-sm text-muted">
          Monitor readiness, recovery, and wellness trends across your roster.
        </p>
      </div>

      {/* Hero Stat Card */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Team Readiness
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Users size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{athletes.length} athlete{athletes.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {withScores.length > 0 ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className={`text-3xl font-bold tabular-nums ${tier.color}`}>
                <AnimatedNumber
                  value={teamAvgRounded}
                  decimals={1}
                  duration={1200}
                />
              </span>
              <span className="text-sm text-muted">avg</span>

              {/* Trend indicator */}
              {teamTrend !== null && teamTrend !== 0 && (
                <span
                  className={`flex items-center gap-0.5 text-sm font-medium ${
                    teamTrend > 0
                      ? "text-emerald-500"
                      : teamTrend < 0
                      ? "text-red-500"
                      : "text-muted"
                  }`}
                >
                  {teamTrend > 0 ? (
                    <TrendingUp size={14} strokeWidth={1.75} aria-hidden="true" />
                  ) : teamTrend < 0 ? (
                    <TrendingDown size={14} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Minus size={14} strokeWidth={1.75} aria-hidden="true" />
                  )}
                  {teamTrend > 0 ? "+" : ""}
                  {teamTrend.toFixed(1)} from last week
                </span>
              )}
            </div>

            <ProgressBar
              value={teamAvgRounded * 10}
              variant={tier.variant}
              size="sm"
              showLabel
              label={`${Math.round(teamAvgRounded * 10)}%`}
            />
          </>
        ) : (
          <p className="text-sm text-muted py-4 text-center">
            No readiness data yet. Athletes can submit daily check-ins from
            their dashboard.
          </p>
        )}
      </div>

      {/* Readiness Grid (client component with filters) */}
      <ReadinessGrid athletes={athletes} />
    </div>
  );
}
