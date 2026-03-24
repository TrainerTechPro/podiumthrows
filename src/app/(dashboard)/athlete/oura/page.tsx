import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { requireAthleteSession } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { ScrollProgressBar } from "@/components/ui/ScrollProgressBar";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatSec(sec: number): string {
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function readinessColor(score: number | null): string {
  if (score === null) return "text-surface-400";
  if (score >= 67) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 34) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function readinessBg(score: number | null): string {
  if (score === null) return "bg-surface-100 dark:bg-surface-800";
  if (score >= 67) return "bg-emerald-50 dark:bg-emerald-500/10";
  if (score >= 34) return "bg-amber-50 dark:bg-amber-500/10";
  return "bg-red-50 dark:bg-red-500/10";
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export default async function OuraPage() {
  const { athlete } = await requireAthleteSession();

  const connection = await prisma.ouraConnection.findUnique({
    where: { athleteId: athlete.id },
    select: { id: true, syncMode: true, lastSyncAt: true },
  });

  if (!connection) {
    redirect("/athlete/settings");
  }

  // Get last 30 days of snapshots
  const snapshots = await prisma.ouraDailySnapshot.findMany({
    where: { connectionId: connection.id },
    orderBy: { date: "desc" },
    take: 30,
  });

  // Get today's snapshot
  const today = new Date().toISOString().split("T")[0];
  const todaySnapshot = snapshots.find((s) => s.date === today);

  // Compute averages from last 7 days
  const last7 = snapshots.slice(0, 7);
  const avg = (arr: (number | null)[]): number | null => {
    const valid = arr.filter((v): v is number => v !== null);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  const avgReadiness = avg(last7.map((s) => s.readinessScore));
  const avgHrv = avg(last7.map((s) => s.hrvMs));
  const avgRhr = avg(last7.map((s) => s.restingHR));
  const avgActivity = avg(last7.map((s) => s.activityScore));
  const avgSleepSec = avg(last7.map((s) => s.sleepDurationSec));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ScrollProgressBar />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Oura Ring Data</h1>
          <p className="text-sm text-muted mt-0.5">
            Readiness, sleep, and activity from your Oura Ring
          </p>
        </div>
        <Link href="/athlete/settings" className="text-xs text-primary-500 hover:underline">
          Settings
        </Link>
      </div>

      {/* Today's Readiness Hero */}
      {todaySnapshot ? (
        <div className={cn("card p-6 text-center", readinessBg(todaySnapshot.readinessScore))}>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Today&apos;s Readiness
          </p>
          <p
            className={cn(
              "text-5xl font-bold font-heading tabular-nums",
              readinessColor(todaySnapshot.readinessScore)
            )}
          >
            {todaySnapshot.readinessScore !== null
              ? `${Math.round(todaySnapshot.readinessScore)}`
              : "\u2014"}
          </p>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            {todaySnapshot.hrvMs !== null && (
              <div>
                <span className="text-muted">HRV</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">
                  {Math.round(todaySnapshot.hrvMs)}ms
                </span>
              </div>
            )}
            {todaySnapshot.restingHR !== null && (
              <div>
                <span className="text-muted">RHR</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">
                  {Math.round(todaySnapshot.restingHR)}bpm
                </span>
              </div>
            )}
            {todaySnapshot.spo2 !== null && (
              <div>
                <span className="text-muted">SpO2</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">
                  {todaySnapshot.spo2.toFixed(1)}%
                </span>
              </div>
            )}
            {todaySnapshot.activityScore !== null && (
              <div>
                <span className="text-muted">Activity</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">
                  {Math.round(todaySnapshot.activityScore)}
                </span>
              </div>
            )}
            {todaySnapshot.steps !== null && (
              <div>
                <span className="text-muted">Steps</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">
                  {todaySnapshot.steps.toLocaleString()}
                </span>
              </div>
            )}
            {todaySnapshot.temperatureDeviation !== null && (
              <div>
                <span className="text-muted">Temp</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">
                  {todaySnapshot.temperatureDeviation > 0 ? "+" : ""}
                  {todaySnapshot.temperatureDeviation.toFixed(1)}&deg;
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">
            No Oura Ring data for today yet. Wear your ring and check back after your readiness is
            scored.
          </p>
        </div>
      )}

      {/* Today's Sleep */}
      {todaySnapshot && todaySnapshot.sleepDurationSec && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Last Night&apos;s Sleep
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {formatSec(todaySnapshot.sleepDurationSec)}
              </p>
              <p className="text-xs text-muted mt-0.5">Total Sleep</p>
            </div>
            {todaySnapshot.sleepScore !== null && (
              <div className="text-center">
                <p className="text-2xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                  {Math.round(todaySnapshot.sleepScore)}
                </p>
                <p className="text-xs text-muted mt-0.5">Sleep Score</p>
              </div>
            )}
            {todaySnapshot.sleepEfficiency !== null && (
              <div className="text-center">
                <p className="text-2xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                  {Math.round(todaySnapshot.sleepEfficiency)}%
                </p>
                <p className="text-xs text-muted mt-0.5">Efficiency</p>
              </div>
            )}
            {(todaySnapshot.remSleepSec || todaySnapshot.deepSleepSec) && (
              <div className="text-center">
                <p className="text-2xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                  {formatSec((todaySnapshot.remSleepSec ?? 0) + (todaySnapshot.deepSleepSec ?? 0))}
                </p>
                <p className="text-xs text-muted mt-0.5">REM + Deep</p>
              </div>
            )}
          </div>

          {/* Sleep stage breakdown bar */}
          {todaySnapshot.lightSleepSec && todaySnapshot.deepSleepSec && todaySnapshot.remSleepSec && (
            <div className="space-y-1.5">
              <div className="flex rounded-full overflow-hidden h-2.5 gap-0.5">
                <div
                  className="bg-blue-400 dark:bg-blue-500 h-full rounded-l-full"
                  style={{
                    width: `${(todaySnapshot.lightSleepSec / todaySnapshot.sleepDurationSec) * 100}%`,
                  }}
                  title="Light sleep"
                />
                <div
                  className="bg-indigo-500 h-full"
                  style={{
                    width: `${(todaySnapshot.deepSleepSec / todaySnapshot.sleepDurationSec) * 100}%`,
                  }}
                  title="Deep sleep"
                />
                <div
                  className="bg-purple-500 h-full rounded-r-full"
                  style={{
                    width: `${(todaySnapshot.remSleepSec / todaySnapshot.sleepDurationSec) * 100}%`,
                  }}
                  title="REM"
                />
              </div>
              <div className="flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Light
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" /> Deep
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> REM
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7-Day Averages */}
      {last7.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            7-Day Averages
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center">
              <p
                className={cn(
                  "text-xl font-bold font-heading tabular-nums",
                  readinessColor(avgReadiness)
                )}
              >
                {avgReadiness !== null ? `${Math.round(avgReadiness)}` : "\u2014"}
              </p>
              <p className="text-xs text-muted mt-0.5">Readiness</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {avgHrv !== null ? `${Math.round(avgHrv)}ms` : "\u2014"}
              </p>
              <p className="text-xs text-muted mt-0.5">HRV</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {avgRhr !== null ? `${Math.round(avgRhr)}` : "\u2014"}
              </p>
              <p className="text-xs text-muted mt-0.5">RHR (bpm)</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {avgActivity !== null ? Math.round(avgActivity).toString() : "\u2014"}
              </p>
              <p className="text-xs text-muted mt-0.5">Activity</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {avgSleepSec !== null ? formatSec(avgSleepSec) : "\u2014"}
              </p>
              <p className="text-xs text-muted mt-0.5">Sleep</p>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {snapshots.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">History</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--card-border)]">
                    {["Date", "Readiness", "HRV", "RHR", "Sleep", "Activity"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {snapshots.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                        {formatDate(s.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn("font-bold tabular-nums", readinessColor(s.readinessScore))}
                        >
                          {s.readinessScore !== null ? `${Math.round(s.readinessScore)}` : "\u2014"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                        {s.hrvMs !== null ? `${Math.round(s.hrvMs)}ms` : "\u2014"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                        {s.restingHR !== null ? `${Math.round(s.restingHR)}` : "\u2014"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                        {s.sleepDurationSec ? formatSec(s.sleepDurationSec) : "\u2014"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                        {s.activityScore !== null ? Math.round(s.activityScore).toString() : "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {snapshots.length === 0 && !todaySnapshot && (
        <div className="card p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-[var(--foreground)]">No Oura Ring data yet</p>
          <p className="text-xs text-muted">
            Data will appear here after your first readiness score is calculated. Make sure your Oura Ring
            is connected and syncing.
          </p>
        </div>
      )}
    </div>
  );
}
