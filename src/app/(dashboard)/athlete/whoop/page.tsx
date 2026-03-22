import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components";
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

function formatMs(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

function recoveryColor(score: number | null): string {
  if (score === null) return "text-surface-400";
  if (score >= 67) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 34) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function recoveryBg(score: number | null): string {
  if (score === null) return "bg-surface-100 dark:bg-surface-800";
  if (score >= 67) return "bg-emerald-50 dark:bg-emerald-500/10";
  if (score >= 34) return "bg-amber-50 dark:bg-amber-500/10";
  return "bg-red-50 dark:bg-red-500/10";
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default async function WhoopPage() {
  const { athlete } = await requireAthleteSession();

  const connection = await prisma.whoopConnection.findUnique({
    where: { athleteId: athlete.id },
    select: { id: true, syncMode: true, lastSyncAt: true },
  });

  if (!connection) {
    redirect("/athlete/settings");
  }

  // Get last 30 days of snapshots
  const snapshots = await prisma.whoopDailySnapshot.findMany({
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

  const avgRecovery = avg(last7.map((s) => s.recoveryScore));
  const avgHrv = avg(last7.map((s) => s.hrvMs));
  const avgRhr = avg(last7.map((s) => s.restingHR));
  const avgStrain = avg(last7.map((s) => s.strain));
  const avgSleepMs = avg(last7.map((s) => s.sleepDurationMs));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ScrollProgressBar />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">WHOOP Data</h1>
          <p className="text-sm text-muted mt-0.5">
            Recovery, sleep, and strain from your WHOOP strap
          </p>
        </div>
        <Link href="/athlete/settings" className="text-xs text-primary-500 hover:underline">
          Settings
        </Link>
      </div>

      {/* Today's Recovery Hero */}
      {todaySnapshot ? (
        <div className={cn("card p-6 text-center", recoveryBg(todaySnapshot.recoveryScore))}>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Today&apos;s Recovery</p>
          <p className={cn("text-5xl font-bold font-heading tabular-nums", recoveryColor(todaySnapshot.recoveryScore))}>
            {todaySnapshot.recoveryScore !== null ? `${Math.round(todaySnapshot.recoveryScore)}%` : "—"}
          </p>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            {todaySnapshot.hrvMs !== null && (
              <div>
                <span className="text-muted">HRV</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">{Math.round(todaySnapshot.hrvMs)}ms</span>
              </div>
            )}
            {todaySnapshot.restingHR !== null && (
              <div>
                <span className="text-muted">RHR</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">{Math.round(todaySnapshot.restingHR)}bpm</span>
              </div>
            )}
            {todaySnapshot.spo2 !== null && (
              <div>
                <span className="text-muted">SpO2</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">{todaySnapshot.spo2.toFixed(1)}%</span>
              </div>
            )}
            {todaySnapshot.strain !== null && (
              <div>
                <span className="text-muted">Strain</span>{" "}
                <span className="font-semibold text-[var(--foreground)] tabular-nums">{todaySnapshot.strain.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm">No WHOOP data for today yet. Wear your strap and check back after your recovery is scored.</p>
        </div>
      )}

      {/* Today's Sleep */}
      {todaySnapshot && todaySnapshot.sleepDurationMs && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Last Night&apos;s Sleep</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {formatMs(todaySnapshot.sleepDurationMs)}
              </p>
              <p className="text-xs text-muted mt-0.5">Total Sleep</p>
            </div>
            {todaySnapshot.sleepPerformance !== null && (
              <div className="text-center">
                <p className="text-2xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                  {Math.round(todaySnapshot.sleepPerformance)}%
                </p>
                <p className="text-xs text-muted mt-0.5">Performance</p>
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
            {(todaySnapshot.remSleepMs || todaySnapshot.swsSleepMs) && (
              <div className="text-center">
                <p className="text-2xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                  {formatMs((todaySnapshot.remSleepMs ?? 0) + (todaySnapshot.swsSleepMs ?? 0))}
                </p>
                <p className="text-xs text-muted mt-0.5">REM + Deep</p>
              </div>
            )}
          </div>

          {/* Sleep stage breakdown bar */}
          {todaySnapshot.lightSleepMs && todaySnapshot.swsSleepMs && todaySnapshot.remSleepMs && (
            <div className="space-y-1.5">
              <div className="flex rounded-full overflow-hidden h-2.5 gap-0.5">
                <div
                  className="bg-blue-400 dark:bg-blue-500 h-full rounded-l-full"
                  style={{ width: `${(todaySnapshot.lightSleepMs / todaySnapshot.sleepDurationMs) * 100}%` }}
                  title="Light sleep"
                />
                <div
                  className="bg-indigo-500 h-full"
                  style={{ width: `${(todaySnapshot.swsSleepMs / todaySnapshot.sleepDurationMs) * 100}%` }}
                  title="Deep (SWS)"
                />
                <div
                  className="bg-purple-500 h-full rounded-r-full"
                  style={{ width: `${(todaySnapshot.remSleepMs / todaySnapshot.sleepDurationMs) * 100}%` }}
                  title="REM"
                />
              </div>
              <div className="flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Light</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Deep</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> REM</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7-Day Averages */}
      {last7.length > 0 && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">7-Day Averages</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="text-center">
              <p className={cn("text-xl font-bold font-heading tabular-nums", recoveryColor(avgRecovery))}>
                {avgRecovery !== null ? `${Math.round(avgRecovery)}%` : "—"}
              </p>
              <p className="text-xs text-muted mt-0.5">Recovery</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {avgHrv !== null ? `${Math.round(avgHrv)}ms` : "—"}
              </p>
              <p className="text-xs text-muted mt-0.5">HRV</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {avgRhr !== null ? `${Math.round(avgRhr)}` : "—"}
              </p>
              <p className="text-xs text-muted mt-0.5">RHR (bpm)</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {avgStrain !== null ? avgStrain.toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted mt-0.5">Strain</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold font-heading text-[var(--foreground)] tabular-nums">
                {avgSleepMs !== null ? formatMs(avgSleepMs) : "—"}
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
                    {["Date", "Recovery", "HRV", "RHR", "Sleep", "Strain"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                  {snapshots.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatDate(s.date)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn("font-bold tabular-nums", recoveryColor(s.recoveryScore))}>
                          {s.recoveryScore !== null ? `${Math.round(s.recoveryScore)}%` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                        {s.hrvMs !== null ? `${Math.round(s.hrvMs)}ms` : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                        {s.restingHR !== null ? `${Math.round(s.restingHR)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                        {s.sleepDurationMs ? formatMs(s.sleepDurationMs) : "—"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-[var(--foreground)]">
                        {s.strain !== null ? s.strain.toFixed(1) : "—"}
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
          <p className="text-sm font-semibold text-[var(--foreground)]">No WHOOP data yet</p>
          <p className="text-xs text-muted">Data will appear here after your first recovery is scored. Make sure your WHOOP strap is connected and syncing.</p>
        </div>
      )}
    </div>
  );
}
