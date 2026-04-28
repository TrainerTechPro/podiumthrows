import Link from "next/link";
import { requireAthleteSession } from "@/lib/data/athlete";
import prisma from "@/lib/prisma";
import { WearableDashboard } from "../_wearable-dashboard";
import { WearableNotConnected } from "../_wearable-not-connected";
import { avg, type WhoopRow } from "../_wearable-helpers";

export const dynamic = "force-dynamic";

export default async function WhoopPage() {
  const { athlete } = await requireAthleteSession();

  const connection = await prisma.whoopConnection.findUnique({
    where: { athleteId: athlete.id },
    select: { id: true, syncMode: true, lastSyncAt: true },
  });

  if (!connection) {
    return <WearableNotConnected provider="whoop" />;
  }

  const snapshots = await prisma.whoopDailySnapshot.findMany({
    where: { connectionId: connection.id },
    orderBy: { date: "desc" },
    take: 30,
  });

  const today = new Date().toISOString().slice(0, 10);
  const todaySnapshot = snapshots.find((s) => s.date === today) ?? null;

  const last7 = snapshots.slice(0, 7);

  const averages: Record<string, number | null> = {
    recoveryScore: avg(last7.map((s) => s.recoveryScore)),
    hrvMs: avg(last7.map((s) => s.hrvMs)),
    restingHR: avg(last7.map((s) => s.restingHR)),
    spo2: avg(last7.map((s) => s.spo2)),
    skinTempC: avg(last7.map((s) => s.skinTempC)),
    strain: avg(last7.map((s) => s.strain)),
    sleepDurationMs: avg(last7.map((s) => s.sleepDurationMs)),
    sleepEfficiency: avg(last7.map((s) => s.sleepEfficiency)),
    sleepPerformance: avg(last7.map((s) => s.sleepPerformance)),
  };

  const historyRows: WhoopRow[] = snapshots.map((s) => ({
    id: s.id,
    date: s.date,
    recoveryScore: s.recoveryScore,
    hrvMs: s.hrvMs,
    restingHR: s.restingHR,
    spo2: s.spo2,
    skinTempC: s.skinTempC,
    strain: s.strain,
    sleepPerformance: s.sleepPerformance,
    sleepDurationMs: s.sleepDurationMs,
    sleepEfficiency: s.sleepEfficiency,
    lightSleepMs: s.lightSleepMs,
    swsSleepMs: s.swsSleepMs,
    remSleepMs: s.remSleepMs,
  }));

  const todayRow: WhoopRow | null = todaySnapshot
    ? (historyRows.find((r) => r.date === today) ?? null)
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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

      <WearableDashboard
        device="whoop"
        today={todayRow}
        history={historyRows}
        averages={averages}
        lastSyncAt={connection.lastSyncAt}
      />
    </div>
  );
}
