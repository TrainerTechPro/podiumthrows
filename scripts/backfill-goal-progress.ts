/**
 * Backfill Goal.currentValue from existing throws sessions.
 *
 * For every active "meters" goal, walks all drill logs at competition weight
 * for that athlete's gender and event, and sets Goal.currentValue to the max
 * of its current value and the best mark found. Goals where currentValue
 * reaches targetValue are marked COMPLETED.
 *
 * This is idempotent and only ever increases currentValue.
 *
 * Usage:
 *   POSTGRES_PRISMA_URL="..." npx tsx scripts/backfill-goal-progress.ts
 *   POSTGRES_PRISMA_URL="..." npx tsx scripts/backfill-goal-progress.ts <athleteId>
 */

import { PrismaClient } from "@prisma/client";
import { syncGoalsFromDrillLogs } from "../src/lib/throws/goal-sync";

const prisma = new PrismaClient();

async function backfillForAthlete(athleteId: string, gender: "MALE" | "FEMALE" | "OTHER") {
  // Pull every drill log grouped by event so we can sync one event at a time
  // (the sync helper scopes goal updates to a single event).
  const sessions = await prisma.athleteThrowsSession.findMany({
    where: { athleteId },
    select: {
      event: true,
      drillLogs: {
        select: { implementWeight: true, bestMark: true },
      },
    },
  });

  if (sessions.length === 0) return 0;

  const byEvent = new Map<string, Array<{ implementWeight: number | null; bestMark: number | null }>>();
  for (const s of sessions) {
    const bucket = byEvent.get(s.event) ?? [];
    for (const log of s.drillLogs) bucket.push(log);
    byEvent.set(s.event, bucket);
  }

  let total = 0;
  for (const [event, logs] of byEvent.entries()) {
    total += await syncGoalsFromDrillLogs(athleteId, event, gender, logs);
  }
  return total;
}

async function main() {
  const onlyAthleteId = process.argv[2];

  const athletes = onlyAthleteId
    ? await prisma.athleteProfile.findMany({
        where: { id: onlyAthleteId },
        select: { id: true, firstName: true, lastName: true, gender: true },
      })
    : await prisma.athleteProfile.findMany({
        select: { id: true, firstName: true, lastName: true, gender: true },
      });

  if (athletes.length === 0) {
    console.log("No athletes found.");
    return;
  }

  console.log(`\nBackfilling goal progress for ${athletes.length} athlete(s)...\n`);

  let grandTotal = 0;
  for (const athlete of athletes) {
    const updated = await backfillForAthlete(athlete.id, athlete.gender);
    grandTotal += updated;
    if (updated > 0) {
      console.log(`  ✓ ${athlete.firstName} ${athlete.lastName} (${athlete.id}): ${updated} goal${updated === 1 ? "" : "s"} updated`);
    }
  }

  console.log(`\nDone. ${grandTotal} goal${grandTotal === 1 ? "" : "s"} updated across ${athletes.length} athlete(s).\n`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
