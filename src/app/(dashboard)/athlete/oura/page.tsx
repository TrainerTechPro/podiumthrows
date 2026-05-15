import Link from "next/link";
import { requireAthleteSession } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { WearableDashboard } from "../_wearable-dashboard";
import { WearableNotConnected } from "../_wearable-not-connected";
import { avg, type OuraRow } from "../_wearable-helpers";

export const dynamic = "force-dynamic";

export default async function OuraPage() {
  const { athlete } = await requireAthleteSession();

  const connection = await prisma.ouraConnection.findUnique({
    where: { athleteId: athlete.id },
    select: { id: true, syncMode: true, lastSyncAt: true },
  });

  if (!connection) {
    return <WearableNotConnected provider="oura" />;
  }

  const snapshots = await prisma.ouraDailySnapshot.findMany({
    where: { connectionId: connection.id },
    orderBy: { date: "desc" },
    take: 30,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySnapshot = snapshots.find((s) => s.date === todayStr) ?? null;
  const last7 = snapshots.slice(0, 7);

  const avgReadiness = avg(last7.map((s) => s.readinessScore));
  const avgHrv = avg(last7.map((s) => s.hrvMs));
  const avgRhr = avg(last7.map((s) => s.restingHR));
  const avgSpo2 = avg(last7.map((s) => s.spo2));
  const avgTempDev = avg(last7.map((s) => s.temperatureDeviation));
  const avgSleepScore = avg(last7.map((s) => s.sleepScore));
  const avgSleepDur = avg(last7.map((s) => s.sleepDurationSec));
  const avgSleepEfficiency = avg(last7.map((s) => s.sleepEfficiency));
  const avgActivity = avg(last7.map((s) => s.activityScore));

  const averages: Record<string, number | null> = {
    readinessScore: avgReadiness,
    hrvMs: avgHrv,
    restingHR: avgRhr,
    spo2: avgSpo2,
    temperatureDeviation: avgTempDev,
    sleepScore: avgSleepScore,
    sleepDurationSec: avgSleepDur,
    sleepEfficiency: avgSleepEfficiency,
    activityScore: avgActivity,
  };

  const toRow = (s: (typeof snapshots)[number]): OuraRow => ({
    id: s.id,
    date: s.date,
    readinessScore: s.readinessScore,
    hrvMs: s.hrvMs,
    restingHR: s.restingHR,
    spo2: s.spo2,
    temperatureDeviation: s.temperatureDeviation,
    sleepScore: s.sleepScore,
    sleepDurationSec: s.sleepDurationSec,
    sleepEfficiency: s.sleepEfficiency,
    lightSleepSec: s.lightSleepSec,
    deepSleepSec: s.deepSleepSec,
    remSleepSec: s.remSleepSec,
    activityScore: s.activityScore,
    steps: s.steps,
  });

  const todayRow: OuraRow | null = todaySnapshot ? toRow(todaySnapshot) : null;
  const historyRows: OuraRow[] = snapshots.map(toRow);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto mb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--foreground)]">Oura Data</h1>
          <p className="text-sm text-muted mt-0.5">
            Readiness, sleep, and activity from your Oura Ring
          </p>
        </div>
        <Link
          href="/athlete/settings"
          className="inline-flex items-center px-3 min-h-[44px] text-xs font-medium text-primary-500 hover:underline shrink-0"
        >
          Settings
        </Link>
      </div>

      <WearableDashboard
        device="oura"
        today={todayRow}
        history={historyRows}
        averages={averages}
        lastSyncAt={connection.lastSyncAt}
      />
    </div>
  );
}
