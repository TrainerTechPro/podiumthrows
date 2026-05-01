/* eslint-disable no-console -- seed script uses console.log for progress reporting */
/**
 * Performance Test Types catalog seed — upsert-only, prod-safe.
 *
 * Same pattern as scripts/seed-implements.ts: extracted from prisma/seed.ts
 * (which wipes test data via deleteMany before reseeding) so it can be
 * safely invoked against production. NEVER calls deleteMany — only upserts
 * test type rows. Re-running produces zero diff if catalog is unchanged.
 *
 * Originally lived only inside the dev seed; this script closes the gap
 * exposed when the Performance Tests feature shipped without a prod seed
 * step, which surfaced as "no tests available" in the athlete picker.
 *
 * Usage (local):
 *   POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" \
 *     POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" \
 *     npx tsx scripts/seed-performance-test-types.ts
 *
 * Usage (prod, post-deploy):
 *   npx tsx scripts/seed-performance-test-types.ts
 *   (uses .env.local prod creds automatically)
 */

import { PrismaClient } from "@prisma/client";

export interface PerformanceTestTypeRow {
  key: string;
  name: string;
  unit: "cm" | "sec";
  lowerIsBetter: boolean;
  defaultAttempts: number;
  iconKey: string;
  sortOrder: number;
}

export const PERFORMANCE_TEST_TYPES: PerformanceTestTypeRow[] = [
  {
    key: "vertical_jump",
    name: "Vertical Jump",
    unit: "cm",
    lowerIsBetter: false,
    defaultAttempts: 3,
    iconKey: "ArrowUp",
    sortOrder: 10,
  },
  {
    key: "broad_jump",
    name: "Broad Jump",
    unit: "cm",
    lowerIsBetter: false,
    defaultAttempts: 3,
    iconKey: "MoveRight",
    sortOrder: 20,
  },
  {
    key: "sprint_10m",
    name: "10 m Sprint",
    unit: "sec",
    lowerIsBetter: true,
    defaultAttempts: 3,
    iconKey: "Timer",
    sortOrder: 30,
  },
  {
    key: "sprint_20m",
    name: "20 m Sprint",
    unit: "sec",
    lowerIsBetter: true,
    defaultAttempts: 3,
    iconKey: "Timer",
    sortOrder: 40,
  },
  {
    key: "sprint_30m",
    name: "30 m Sprint",
    unit: "sec",
    lowerIsBetter: true,
    defaultAttempts: 2,
    iconKey: "Timer",
    sortOrder: 50,
  },
  {
    key: "sprint_40yd",
    name: "40 yd Sprint",
    unit: "sec",
    lowerIsBetter: true,
    defaultAttempts: 2,
    iconKey: "Timer",
    sortOrder: 60,
  },
];

/**
 * Idempotent upsert. Safe to call repeatedly. Never deletes test type rows
 * — only inserts new ones and updates labels/sort/unit on existing.
 */
export async function seedPerformanceTestTypes(prisma: PrismaClient): Promise<void> {
  for (const t of PERFORMANCE_TEST_TYPES) {
    await prisma.performanceTestType.upsert({
      where: { key: t.key },
      create: t,
      update: {
        name: t.name,
        unit: t.unit,
        lowerIsBetter: t.lowerIsBetter,
        defaultAttempts: t.defaultAttempts,
        iconKey: t.iconKey,
        sortOrder: t.sortOrder,
        archived: false,
      },
    });
  }
}

/* ─── CLI entrypoint ────────────────────────────────────────────────────── */

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(`\nSeeding performance test types (${PERFORMANCE_TEST_TYPES.length} rows)...\n`);
    await seedPerformanceTestTypes(prisma);

    const all = await prisma.performanceTestType.findMany({
      orderBy: { sortOrder: "asc" },
      select: { key: true, name: true, unit: true, archived: true },
    });
    for (const t of all) {
      console.log(
        `  ${t.key.padEnd(16)} ${t.name.padEnd(16)} ${t.unit.padEnd(4)} ${t.archived ? "[archived]" : ""}`
      );
    }
    console.log(`\n  ${all.length} test types total.\n`);
    console.log("Done.\n");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Performance test types seed failed:", err);
    process.exit(1);
  });
}
