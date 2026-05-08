/**
 * Idempotent upsert of the synthetic-monitoring sentinel accounts that
 * scripts/deploy.sh authenticates as during the post-deploy auth smoke.
 *
 * Per memory/feedback_never_seed_production.md, this script REFUSES to use
 * .env.local — the caller must set TARGET_DATABASE_URL explicitly. Run once
 * against prod after the migration that adds User.isSmokeAccount lands, and
 * again whenever SMOKE_PASSWORD rotates.
 *
 * Usage:
 *   SMOKE_PASSWORD=<32-char-random> \
 *   TARGET_DATABASE_URL="postgresql://..." \
 *   npx tsx scripts/upsert-smoke-accounts.ts
 *
 * Both rows carry isSmokeAccount=true. seed.ts already excludes them from
 * its cleanup, so an accidental seed against prod won't nuke them.
 */
/* eslint-disable no-console -- script uses console for progress output */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const COACH_EMAIL = "smoke+monitor@podiumthrows.com";
const ATHLETE_EMAIL = "smoke+athlete@podiumthrows.com";

async function main(): Promise<void> {
  const dbUrl = process.env.TARGET_DATABASE_URL;
  if (!dbUrl) {
    console.error(
      "✗ TARGET_DATABASE_URL not set. Refusing to fall back to .env.local " +
        "(prod creds live there — see feedback_never_seed_production.md)."
    );
    process.exit(1);
  }
  const password = process.env.SMOKE_PASSWORD;
  if (!password || password.length < 16) {
    console.error("✗ SMOKE_PASSWORD must be set to at least 16 chars.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const coachUser = await prisma.user.upsert({
      where: { email: COACH_EMAIL },
      update: { passwordHash, isSmokeAccount: true, role: "COACH" },
      create: {
        email: COACH_EMAIL,
        passwordHash,
        role: "COACH",
        isSmokeAccount: true,
      },
    });

    const coachProfile = await prisma.coachProfile.upsert({
      where: { userId: coachUser.id },
      update: {},
      create: {
        userId: coachUser.id,
        firstName: "Smoke",
        lastName: "Monitor",
        organization: "Synthetic Monitoring",
      },
    });
    console.log(`  ✓ Coach upserted: ${COACH_EMAIL} (User=${coachUser.id})`);

    const athleteUser = await prisma.user.upsert({
      where: { email: ATHLETE_EMAIL },
      update: { passwordHash, isSmokeAccount: true, role: "ATHLETE" },
      create: {
        email: ATHLETE_EMAIL,
        passwordHash,
        role: "ATHLETE",
        isSmokeAccount: true,
        claimedAt: new Date(),
      },
    });

    await prisma.athleteProfile.upsert({
      where: { userId: athleteUser.id },
      update: { coachId: coachProfile.id },
      create: {
        userId: athleteUser.id,
        coachId: coachProfile.id,
        firstName: "Smoke",
        lastName: "Athlete",
        events: ["SHOT_PUT"],
        gender: "OTHER",
      },
    });
    console.log(`  ✓ Athlete upserted: ${ATHLETE_EMAIL} (User=${athleteUser.id})`);
    console.log(`  ✓ Athlete attached to smoke coach (CoachProfile=${coachProfile.id})`);

    console.log("\nNext steps:");
    console.log("  1. In Vercel → Settings → Environment Variables (Production):");
    console.log(`       SMOKE_COACH_EMAIL=${COACH_EMAIL}`);
    console.log(`       SMOKE_ATHLETE_EMAIL=${ATHLETE_EMAIL}`);
    console.log("       SMOKE_PASSWORD=<the value you just used>");
    console.log("  2. Run `npx vercel env pull .env.vercel.local --yes` locally.");
    console.log("  3. Next `scripts/deploy.sh prod` will exercise the auth'd smoke.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
