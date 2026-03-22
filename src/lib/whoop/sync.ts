import prisma from "@/lib/prisma";
import { fetchRecovery, fetchSleep, fetchStrain } from "./client";

// ─── Sync WHOOP Data ──────────────────────────────────────────────────────────

/**
 * Fetches recovery, sleep, and strain from WHOOP for the given connection,
 * upserts a WhoopDailySnapshot for today, and (if syncMode=AUTO) creates
 * or updates a ReadinessCheckIn.
 */
export async function syncWhoopData(connectionId: string): Promise<void> {
  const connection = await prisma.whoopConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  const [recovery, sleep, strain] = await Promise.all([
    fetchRecovery(connectionId),
    fetchSleep(connectionId),
    fetchStrain(connectionId),
  ]);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Upsert today's snapshot
  const snapshot = await prisma.whoopDailySnapshot.upsert({
    where: {
      connectionId_date: {
        connectionId,
        date: today,
      },
    },
    create: {
      connectionId,
      date: today,
      recoveryScore: recovery.recoveryScore,
      hrvMs: recovery.hrvMs,
      restingHR: recovery.restingHR,
      spo2: recovery.spo2,
      skinTempC: recovery.skinTempC,
      sleepPerformance: sleep.sleepPerformance,
      sleepDurationMs: sleep.sleepDurationMs,
      sleepEfficiency: sleep.sleepEfficiency,
      lightSleepMs: sleep.lightSleepMs,
      swsSleepMs: sleep.swsSleepMs,
      remSleepMs: sleep.remSleepMs,
      strain: strain.strain,
      rawData: JSON.stringify({ recovery, sleep, strain }),
    },
    update: {
      recoveryScore: recovery.recoveryScore,
      hrvMs: recovery.hrvMs,
      restingHR: recovery.restingHR,
      spo2: recovery.spo2,
      skinTempC: recovery.skinTempC,
      sleepPerformance: sleep.sleepPerformance,
      sleepDurationMs: sleep.sleepDurationMs,
      sleepEfficiency: sleep.sleepEfficiency,
      lightSleepMs: sleep.lightSleepMs,
      swsSleepMs: sleep.swsSleepMs,
      remSleepMs: sleep.remSleepMs,
      strain: strain.strain,
      rawData: JSON.stringify({ recovery, sleep, strain }),
    },
  });

  // If AUTO mode, create or update the ReadinessCheckIn
  if (connection.syncMode === "AUTO") {
    await getOrCreateAutoCheckIn(connection.athleteId, snapshot, connectionId);
  }

  // Update lastSyncAt
  await prisma.whoopConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date() },
  });
}

// ─── Auto Check-In ────────────────────────────────────────────────────────────

interface SnapshotData {
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  sleepPerformance: number | null;
  sleepDurationMs: number | null;
  strain: number | null;
}

/**
 * Maps WHOOP snapshot data to a ReadinessCheckIn.
 * Creates a new check-in or updates today's existing one.
 */
export async function getOrCreateAutoCheckIn(
  athleteId: string,
  snapshot: SnapshotData,
  _connectionId: string
): Promise<void> {
  // Build today's date range (midnight to midnight)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  // Map WHOOP values to ReadinessCheckIn fields
  const overallScore =
    snapshot.recoveryScore != null
      ? Math.max(1, Math.min(10, Math.round(snapshot.recoveryScore / 10)))
      : 5;
  const sleepQuality =
    snapshot.sleepPerformance != null
      ? Math.max(1, Math.min(10, Math.round(snapshot.sleepPerformance / 10)))
      : 5;
  const sleepHours = snapshot.sleepDurationMs != null ? snapshot.sleepDurationMs / 3_600_000 : 7;

  const checkInData = {
    overallScore,
    sleepQuality,
    sleepHours,
    soreness: 5,
    stressLevel: 5,
    energyMood: 5,
    hydration: "ADEQUATE" as const,
    injuryStatus: "NONE" as const,
    source: "WHOOP_AUTO",
    hrvMs: snapshot.hrvMs,
    restingHR: snapshot.restingHR,
    spo2: snapshot.spo2,
    whoopStrain: snapshot.strain,
  };

  // Look for an existing check-in for today
  const existing = await prisma.readinessCheckIn.findFirst({
    where: {
      athleteId,
      date: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  if (existing) {
    await prisma.readinessCheckIn.update({
      where: { id: existing.id },
      data: checkInData,
    });
  } else {
    await prisma.readinessCheckIn.create({
      data: {
        athleteId,
        date: startOfDay,
        ...checkInData,
      },
    });
  }
}

// ─── Assisted Mode Helper ─────────────────────────────────────────────────────

/**
 * Returns today's WhoopDailySnapshot for the given athlete, if one exists.
 * Used in ASSISTED mode to pre-fill the readiness check-in form.
 */
export async function getTodaySnapshot(athleteId: string) {
  const connection = await prisma.whoopConnection.findUnique({
    where: { athleteId },
  });

  if (!connection) return null;

  const today = new Date().toISOString().slice(0, 10);

  return prisma.whoopDailySnapshot.findUnique({
    where: {
      connectionId_date: {
        connectionId: connection.id,
        date: today,
      },
    },
  });
}
