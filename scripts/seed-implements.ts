/* eslint-disable no-console -- seed script uses console.log for progress reporting */
/**
 * Implement catalog seed — upsert-only, prod-safe.
 *
 * Lives separately from prisma/seed.ts (which wipes test data via deleteMany
 * before reseeding) so it can be safely invoked against production after a
 * schema migration. NEVER calls deleteMany — only upserts catalog rows and
 * their category tags. Re-running produces zero diff if catalog is unchanged.
 *
 * Single source of truth for the catalog content. prisma/seed.ts also imports
 * IMPLEMENT_CATALOG and seedImplementCatalog from here so dev seed + prod
 * deploy stay in lock-step.
 *
 * Usage (local):
 *   POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" \
 *     POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" \
 *     npx tsx scripts/seed-implements.ts
 *
 * Usage (prod, post-deploy):
 *   POSTGRES_PRISMA_URL="<prod-pooler>" POSTGRES_URL_NON_POOLING="<prod-direct>" \
 *     npx tsx scripts/seed-implements.ts
 */

import { PrismaClient, type ImplementType, type ImplementCategory } from "@prisma/client";

const KG_PER_LB = 0.45359237;
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CatalogRow {
  throwType: ImplementType;
  weightKg: number;
  primaryUnit: "kg" | "lb";
  displayLabel: string;
  shortLabel: string;
  sortOrder: number;
  categories: ImplementCategory[];
}

function kgRow(
  throwType: ImplementType,
  kg: number,
  display: string,
  short: string,
  sortOrder: number,
  categories: ImplementCategory[]
): CatalogRow {
  return {
    throwType,
    weightKg: kg,
    primaryUnit: "kg",
    displayLabel: display,
    shortLabel: short,
    sortOrder,
    categories,
  };
}

function lbRow(
  throwType: ImplementType,
  lb: number,
  sortOrder: number,
  categories: ImplementCategory[]
): CatalogRow {
  const kg = round2(lb * KG_PER_LB);
  return {
    throwType,
    weightKg: kg,
    primaryUnit: "lb",
    displayLabel: `${lb} lb`,
    shortLabel: `${lb}lb`,
    sortOrder,
    categories,
  };
}

export const IMPLEMENT_CATALOG: CatalogRow[] = [
  // ─── HAMMER metric ────
  kgRow("HAMMER", 3, "3 kg", "3kg", 100, ["WOMEN_U20", "TRAINING_LIGHT"]),
  kgRow("HAMMER", 4, "4 kg", "4kg", 110, ["WOMEN_SENIOR", "WOMEN_U20", "HS_GIRLS"]),
  kgRow("HAMMER", 5, "5 kg", "5kg", 120, ["WOMEN_SENIOR", "TRAINING_HEAVY"]),
  kgRow("HAMMER", 6, "6 kg", "6kg", 130, ["MEN_U20", "WOMEN_SENIOR", "TRAINING_HEAVY"]),
  kgRow("HAMMER", 7, "7 kg", "7kg", 140, ["MEN_SENIOR", "TRAINING_LIGHT"]),
  kgRow("HAMMER", 7.26, "7.26 kg", "7.26kg", 150, ["MEN_SENIOR"]),
  kgRow("HAMMER", 8, "8 kg", "8kg", 160, ["MEN_SENIOR", "TRAINING_HEAVY"]),
  kgRow("HAMMER", 9, "9 kg", "9kg", 170, ["MEN_SENIOR", "TRAINING_HEAVY"]),
  kgRow("HAMMER", 10, "10 kg", "10kg", 180, ["TRAINING_HEAVY"]),
  kgRow("HAMMER", 11, "11 kg", "11kg", 190, ["TRAINING_HEAVY"]),
  kgRow("HAMMER", 12, "12 kg", "12kg", 200, ["TRAINING_HEAVY"]),

  // ─── HAMMER imperial ────
  lbRow("HAMMER", 6, 210, ["WOMEN_U20", "TRAINING_LIGHT"]),
  lbRow("HAMMER", 8, 220, ["WOMEN_SENIOR", "HS_GIRLS"]),
  lbRow("HAMMER", 10, 230, ["WOMEN_SENIOR", "TRAINING_HEAVY"]),
  lbRow("HAMMER", 12, 240, ["MEN_U20", "HS_BOYS", "WOMEN_SENIOR", "TRAINING_HEAVY"]),
  lbRow("HAMMER", 14, 250, ["TRAINING_LIGHT"]),
  lbRow("HAMMER", 16, 260, ["MEN_SENIOR"]),
  lbRow("HAMMER", 18, 265, ["MEN_SENIOR", "TRAINING_HEAVY"]),
  lbRow("HAMMER", 20, 270, ["MEN_SENIOR", "TRAINING_HEAVY"]),
  lbRow("HAMMER", 25, 280, ["TRAINING_HEAVY"]),
  lbRow("HAMMER", 35, 290, ["TRAINING_HEAVY"]),

  // ─── SHOT metric ────
  kgRow("SHOT", 3, "3 kg", "3kg", 300, ["WOMEN_U20", "HS_GIRLS", "TRAINING_LIGHT"]),
  kgRow("SHOT", 4, "4 kg", "4kg", 310, ["WOMEN_SENIOR", "WOMEN_U20", "HS_GIRLS"]),
  kgRow("SHOT", 5, "5 kg", "5kg", 320, ["WOMEN_SENIOR", "HS_BOYS", "TRAINING_HEAVY"]),
  kgRow("SHOT", 6, "6 kg", "6kg", 330, ["MEN_U20", "WOMEN_SENIOR", "TRAINING_HEAVY"]),
  kgRow("SHOT", 7.26, "7.26 kg", "7.26kg", 340, ["MEN_SENIOR"]),
  kgRow("SHOT", 8, "8 kg", "8kg", 350, ["MEN_SENIOR", "TRAINING_HEAVY"]),
  kgRow("SHOT", 9, "9 kg", "9kg", 360, ["MEN_SENIOR", "TRAINING_HEAVY"]),
  kgRow("SHOT", 10, "10 kg", "10kg", 370, ["TRAINING_HEAVY"]),
  kgRow("SHOT", 12, "12 kg", "12kg", 380, ["TRAINING_HEAVY"]),

  // ─── SHOT imperial ────
  lbRow("SHOT", 6, 390, ["WOMEN_U20", "HS_GIRLS", "TRAINING_LIGHT"]),
  lbRow("SHOT", 8, 400, ["WOMEN_SENIOR", "HS_GIRLS"]),
  lbRow("SHOT", 12, 410, ["MEN_U20", "HS_BOYS", "WOMEN_SENIOR", "TRAINING_HEAVY"]),
  lbRow("SHOT", 16, 420, ["MEN_SENIOR"]),
  lbRow("SHOT", 20, 430, ["TRAINING_HEAVY"]),
  lbRow("SHOT", 25, 440, ["TRAINING_HEAVY"]),
  lbRow("SHOT", 35, 450, ["TRAINING_HEAVY"]),

  // ─── DISCUS metric ────
  kgRow("DISCUS", 0.6, "600 g", "600g", 500, ["HS_GIRLS", "TRAINING_LIGHT"]),
  kgRow("DISCUS", 0.75, "750 g", "750g", 510, ["WOMEN_U20", "TRAINING_LIGHT"]),
  kgRow("DISCUS", 1, "1 kg", "1kg", 520, ["WOMEN_SENIOR", "WOMEN_U20", "HS_GIRLS"]),
  kgRow("DISCUS", 1.25, "1.25 kg", "1.25kg", 530, ["TRAINING_HEAVY"]),
  kgRow("DISCUS", 1.5, "1.5 kg", "1.5kg", 540, ["MEN_U20", "TRAINING_LIGHT"]),
  kgRow("DISCUS", 1.6, "1.6 kg", "1.6kg", 550, ["HS_BOYS"]),
  kgRow("DISCUS", 1.75, "1.75 kg", "1.75kg", 560, ["MEN_U20", "TRAINING_LIGHT"]),
  kgRow("DISCUS", 2, "2 kg", "2kg", 570, ["MEN_SENIOR"]),

  // ─── JAVELIN metric (grams, stored as kg) ────
  kgRow("JAVELIN", 0.4, "400 g", "400g", 600, ["WOMEN_U20", "HS_GIRLS", "TRAINING_LIGHT"]),
  kgRow("JAVELIN", 0.5, "500 g", "500g", 610, ["WOMEN_U20", "TRAINING_LIGHT"]),
  kgRow("JAVELIN", 0.6, "600 g", "600g", 620, ["WOMEN_SENIOR", "HS_GIRLS"]),
  kgRow("JAVELIN", 0.7, "700 g", "700g", 630, ["MEN_U20", "HS_BOYS", "TRAINING_LIGHT"]),
  kgRow("JAVELIN", 0.8, "800 g", "800g", 640, ["MEN_SENIOR"]),
];

/**
 * Idempotent upsert. Safe to call repeatedly. Never deletes catalog rows
 * — only inserts new ones and updates labels/sort/categories on existing.
 *
 * Uses findFirst+create/update rather than `upsert` because the compound
 * unique key was replaced by partial unique indexes when per-coach custom
 * implements were added (see 20260502120000_add_custom_implements).
 */
export async function seedImplementCatalog(prisma: PrismaClient): Promise<void> {
  for (const row of IMPLEMENT_CATALOG) {
    const weightLb = round2(row.weightKg / KG_PER_LB);

    const existing = await prisma.implement.findFirst({
      where: {
        ownerId: null,
        throwType: row.throwType,
        weightKg: row.weightKg,
        primaryUnit: row.primaryUnit,
        displayLabel: row.displayLabel,
      },
      select: { id: true },
    });

    const upserted = existing
      ? await prisma.implement.update({
          where: { id: existing.id },
          data: {
            weightLb,
            shortLabel: row.shortLabel,
            sortOrder: row.sortOrder,
            active: true,
          },
        })
      : await prisma.implement.create({
          data: {
            throwType: row.throwType,
            weightKg: row.weightKg,
            weightLb,
            primaryUnit: row.primaryUnit,
            displayLabel: row.displayLabel,
            shortLabel: row.shortLabel,
            sortOrder: row.sortOrder,
            active: true,
          },
        });

    // Replace category tags for this implement (idempotent — never deletes rows
    // in the wider tag table; only deletes tags that are no longer in the row's
    // declared category list).
    await prisma.implementCategoryTag.deleteMany({
      where: {
        implementId: upserted.id,
        category: { notIn: row.categories },
      },
    });
    for (const category of row.categories) {
      await prisma.implementCategoryTag.upsert({
        where: { implementId_category: { implementId: upserted.id, category } },
        create: { implementId: upserted.id, category },
        update: {},
      });
    }
  }
}

/* ─── CLI entrypoint ────────────────────────────────────────────────────── */

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log(`\nSeeding implement catalog (${IMPLEMENT_CATALOG.length} rows)...\n`);
    await seedImplementCatalog(prisma);

    const counts = await prisma.implement.groupBy({
      by: ["throwType"],
      _count: { _all: true },
      orderBy: { throwType: "asc" },
    });
    for (const c of counts) {
      console.log(`  ${c.throwType.padEnd(10)} ${c._count._all} rows`);
    }
    const tagCount = await prisma.implementCategoryTag.count();
    console.log(`\n  ${tagCount} category tags total.\n`);
    console.log("Done.\n");
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when invoked directly (not on import).
if (require.main === module) {
  main().catch((err) => {
    console.error("Catalog seed failed:", err);
    process.exit(1);
  });
}
