/**
 * Migrate coach self-training data to the athlete-side models.
 *
 * Run with:
 *   POSTGRES_PRISMA_URL="..." npx tsx scripts/migrate-coach-training-data.ts <email>
 *
 * What it does:
 * 1. Finds the coach by email
 * 2. Ensures Training Mode is enabled (creates AthleteProfile if needed)
 * 3. Copies CoachThrowsSession → AthleteThrowsSession (with drill logs)
 * 4. Copies CoachPR → ThrowsPR
 * 5. Reports counts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/migrate-coach-training-data.ts <email>");
    process.exit(1);
  }

  console.log(`\nMigrating training data for: ${email}\n`);

  // Find user
  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      coachProfile: {
        select: {
          id: true, firstName: true, lastName: true, avatarUrl: true,
          events: true, trainingEnabled: true,
        },
      },
      athleteProfile: {
        select: { id: true, isSelfCoached: true },
      },
    },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  if (!user.coachProfile) {
    console.error("User has no coach profile");
    process.exit(1);
  }

  const coach = user.coachProfile;
  let athleteId = user.athleteProfile?.id;

  // Enable Training Mode if not already
  if (!athleteId) {
    console.log("Creating AthleteProfile (Training Mode not yet enabled)...");
    const athlete = await prisma.athleteProfile.create({
      data: {
        userId: user.id,
        coachId: coach.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        avatarUrl: coach.avatarUrl,
        events: coach.events,
        gender: "OTHER",
        isSelfCoached: true,
      },
    });
    athleteId = athlete.id;

    await prisma.coachProfile.update({
      where: { id: coach.id },
      data: { trainingEnabled: true },
    });
    console.log(`  Created AthleteProfile: ${athleteId}`);
  } else {
    // Sync avatar if missing
    if (!user.athleteProfile?.isSelfCoached) {
      console.log("WARNING: Existing AthleteProfile is not self-coached. Skipping.");
      process.exit(1);
    }
    // Sync avatar from coach
    await prisma.athleteProfile.update({
      where: { id: athleteId },
      data: { avatarUrl: coach.avatarUrl },
    });
    console.log(`  AthleteProfile exists: ${athleteId} (avatar synced)`);
  }

  // Count existing coach data
  const sessionCount = await prisma.coachThrowsSession.count({ where: { coachId: coach.id } });
  const prCount = await prisma.coachPR.count({ where: { coachId: coach.id } });
  console.log(`\nCoach training data found: ${sessionCount} sessions, ${prCount} PRs`);

  // Migrate sessions: CoachThrowsSession → AthleteThrowsSession
  if (sessionCount > 0) {
    const sessions = await prisma.coachThrowsSession.findMany({
      where: { coachId: coach.id },
      include: { drillLogs: true },
      orderBy: { date: "asc" },
    });

    let migratedSessions = 0;
    for (const session of sessions) {
      // Check if already migrated (same date + event)
      const existing = await prisma.athleteThrowsSession.findFirst({
        where: { athleteId, event: session.event, date: session.date },
      });
      if (existing) continue;

      await prisma.athleteThrowsSession.create({
        data: {
          athleteId,
          event: session.event,
          date: session.date,
          focus: session.focus,
          notes: session.notes,
          sleepQuality: session.sleepQuality,
          sorenessLevel: session.sorenessLevel,
          energyLevel: session.energyLevel,
          sessionRpe: session.sessionRpe,
          sessionFeeling: session.sessionFeeling,
          techniqueRating: session.techniqueRating,
          mentalFocus: session.mentalFocus,
          bestPart: session.bestPart,
          improvementArea: session.improvementArea,
          drillLogs: {
            create: session.drillLogs.map((d) => ({
              drillType: d.drillType,
              implementWeight: d.implementWeight,
              implementWeightUnit: d.implementWeightUnit,
              implementWeightOriginal: d.implementWeightOriginal,
              wireLength: d.wireLength,
              throwCount: d.throwCount,
              bestMark: d.bestMark,
              notes: d.notes,
            })),
          },
        },
      });
      migratedSessions++;
    }
    console.log(`  Migrated ${migratedSessions} sessions (${sessionCount - migratedSessions} already existed)`);
  }

  // Migrate PRs: CoachPR → ThrowsPR
  if (prCount > 0) {
    const prs = await prisma.coachPR.findMany({ where: { coachId: coach.id } });

    let migratedPRs = 0;
    for (const pr of prs) {
      // Check if already migrated
      const existing = await prisma.throwsPR.findFirst({
        where: { athleteId, event: pr.event, implement: pr.implement },
      });
      if (existing) continue;

      await prisma.throwsPR.create({
        data: {
          athleteId,
          event: pr.event,
          implement: pr.implement,
          distance: pr.distance,
          achievedAt: pr.achievedAt instanceof Date ? pr.achievedAt.toISOString().split("T")[0] : String(pr.achievedAt),
          source: pr.source ?? "migration",
        },
      });
      migratedPRs++;
    }
    console.log(`  Migrated ${migratedPRs} PRs (${prCount - migratedPRs} already existed)`);
  }

  console.log("\nDone!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
