import { InviteAthleteButton } from "./_invite";
import { AthletesTable } from "./_table";
import {
  requireCoachSession,
  getAthleteRoster,
  PLAN_LIMITS,
} from "@/lib/data/coach";
import type { PlanName } from "@/lib/stripe";

export default async function AthletesPage() {
  const { coach } = await requireCoachSession();
  const roster = await getAthleteRoster(coach.id);
  const planLimit = PLAN_LIMITS[coach.plan];

  // Sort: lowest readiness first (needs attention), no check-in last
  const sorted = [...roster].sort((a, b) => {
    const aScore = a.latestReadiness?.score ?? 999;
    const bScore = b.latestReadiness?.score ?? 999;
    if (aScore !== bScore) return aScore - bScore;
    return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
  });

  const lowCount = roster.filter((a) => a.latestReadiness && a.latestReadiness.score < 5).length;
  const noCheckInCount = roster.filter((a) => !a.latestReadiness).length;
  const needsAttention = lowCount + noCheckInCount;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">
            Athletes
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {roster.length}{" "}
            {roster.length === 1 ? "athlete" : "athletes"} on your roster
          </p>
        </div>
        <InviteAthleteButton
          athleteCount={roster.length}
          planLimit={planLimit}
          currentPlan={coach.plan as PlanName}
        />
      </div>

      {/* Attention banner */}
      {needsAttention > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400 leading-snug">
            {lowCount > 0 && noCheckInCount > 0 ? (
              <><strong>{lowCount}</strong> {lowCount === 1 ? "athlete has" : "athletes have"} low readiness and <strong>{noCheckInCount}</strong> {noCheckInCount === 1 ? "hasn't" : "haven't"} checked in recently.</>
            ) : lowCount > 0 ? (
              <><strong>{lowCount}</strong> {lowCount === 1 ? "athlete has" : "athletes have"} a readiness score below 5 — consider adjusting training load.</>
            ) : (
              <><strong>{noCheckInCount}</strong> {noCheckInCount === 1 ? "athlete hasn't" : "athletes haven't"} submitted a readiness check-in yet.</>
            )}
          </p>
        </div>
      )}

      {/* Table — sorted worst readiness first */}
      <AthletesTable data={sorted} />
    </div>
  );
}
