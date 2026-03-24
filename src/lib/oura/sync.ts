import prisma from "@/lib/prisma";
import { fetchReadiness, fetchSleep, fetchActivity, fetchSpo2 } from "./client";

// ─── Sync Oura Data ──────────────────────────────────────────────────────────

/**
 * Fetches readiness, sleep, activity, and SpO2 from Oura for the given connection,
 * upserts an OuraDailySnapshot for today, and (if syncMode=AUTO) creates
 * or updates a ReadinessCheckIn.
 */
export async function syncOuraData(connectionId: string): Promise<void> {
  const connection = await prisma.ouraConnection.findUniqueOrThrow({
    where: { id: connectionId },
  });

  // Fetch all four in parallel — if one fails, continue with the others
  const [readinessResult, sleepResult, activityResult, spo2Result] = await Promise.allSettled([
    fetchReadiness(connectionId),
    fetchSleep(connectionId),
    fetchActivity(connectionId),
    fetchSpo2(connectionId),
  ]);

  const readiness = readinessResult.status === "fulfilled"
    ? readinessResult.value
    : { readinessScore: null, temperatureDeviation: null };
  const sleep = sleepResult.status === "fulfilled"
    ? sleepResult.value
    : { sleepScore: null, sleepDurationSec: null, sleepEfficiency: null, lightSleepSec: null, deepSleepSec: null, remSleepSec: null, hrvMs: null, restingHR: null };
  const activity = activityResult.status === "fulfilled"
    ? activityResult.value
    : { activityScore: null, steps: null };
  const spo2 = spo2Result.status === "fulfilled"
    ? spo2Result.value
    : { spo2: null };

  // If ALL four failed, throw so the caller knows
  if (
    readinessResult.status === "rejected" &&
    sleepResult.status === "rejected" &&
    activityResult.status === "rejected" &&
    spo2Result.status === "rejected"
  ) {
    throw new Error(`All Oura API calls failed: ${(readinessResult as PromiseRejectedResult).reason?.message ?? "unknown"}`);
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Upsert today's snapshot
  const snapshot = await prisma.ouraDailySnapshot.upsert({
    where: {
      connectionId_date: {
        connectionId,
        date: today,
      },
    },
    create: {
      connectionId,
      date: today,
      readinessScore: readiness.readinessScore,
      temperatureDeviation: readiness.temperatureDeviation,
      hrvMs: sleep.hrvMs,
      restingHR: sleep.restingHR,
      sleepScore: sleep.sleepScore,
      sleepDurationSec: sleep.sleepDurationSec,
      sleepEfficiency: sleep.sleepEfficiency,
      lightSleepSec: sleep.lightSleepSec,
      deepSleepSec: sleep.deepSleepSec,
      remSleepSec: sleep.remSleepSec,
      spo2: spo2.spo2,
      activityScore: activity.activityScore,
      steps: activity.steps,
      rawData: JSON.stringify({ readiness, sleep, activity, spo2 }),
    },
    update: {
      readinessScore: readiness.readinessScore,
      temperatureDeviation: readiness.temperatureDeviation,
      hrvMs: sleep.hrvMs,
      restingHR: sleep.restingHR,
      sleepScore: sleep.sleepScore,
      sleepDurationSec: sleep.sleepDurationSec,
      sleepEfficiency: sleep.sleepEfficiency,
      lightSleepSec: sleep.lightSleepSec,
      deepSleepSec: sleep.deepSleepSec,
      remSleepSec: sleep.remSleepSec,
      spo2: spo2.spo2,
      activityScore: activity.activityScore,
      steps: activity.steps,
      rawData: JSON.stringify({ readiness, sleep, activity, spo2 }),
    },
  });

  // If AUTO mode, create or update the ReadinessCheckIn
  if (connection.syncMode === "AUTO") {
    await getOrCreateAutoCheckIn(connection.athleteId, snapshot, connectionId);
  }

  // Update lastSyncAt
  await prisma.ouraConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date() },
  });
}

// ─── Auto Check-In ────────────────────────────────────────────────────────────

interface SnapshotData {
  readinessScore: number | null;
  hrvMs: number | null;
  restingHR: number | null;
  spo2: number | null;
  sleepScore: number | null;
  sleepDurationSec: number | null;
  activityScore: number | null;
  temperatureDeviation: number | null;
}

/**
 * Maps Oura snapshot data to a ReadinessCheckIn.
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

  // Map Oura values to ReadinessCheckIn fields
  const overallScore =
    snapshot.readinessScore != null
      ? Math.max(1, Math.min(10, Math.round(snapshot.readinessScore / 10)))
      : 5;
  const sleepQuality =
    snapshot.sleepScore != null
      ? Math.max(1, Math.min(10, Math.round(snapshot.sleepScore / 10)))
      : 5;
  const sleepHours = snapshot.sleepDurationSec != null ? snapshot.sleepDurationSec / 3600 : 7;

  const checkInData = {
    overallScore,
    sleepQuality,
    sleepHours,
    soreness: 5,
    stressLevel: 5,
    energyMood: 5,
    hydration: "ADEQUATE" as const,
    injuryStatus: "NONE" as const,
    source: "OURA_AUTO",
    hrvMs: snapshot.hrvMs,
    restingHR: snapshot.restingHR,
    spo2: snapshot.spo2,
    ouraReadiness: snapshot.readinessScore,
    ouraActivityScore: snapshot.activityScore,
    temperatureDeviation: snapshot.temperatureDeviation,
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
 * Returns today's OuraDailySnapshot for the given athlete, if one exists.
 * Used in ASSISTED mode to pre-fill the readiness check-in form.
 */
export async function getTodaySnapshot(athleteId: string) {
  const connection = await prisma.ouraConnection.findUnique({
    where: { athleteId },
  });

  if (!connection) return null;

  const today = new Date().toISOString().slice(0, 10);

  return prisma.ouraDailySnapshot.findUnique({
    where: {
      connectionId_date: {
        connectionId: connection.id,
        date: today,
      },
    },
  });
}
