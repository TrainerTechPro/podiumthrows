/* eslint-disable no-console -- script uses console.log for progress reporting */
/**
 * Dedupe legacy ThrowsPR rows that represent the same physical implement
 * stored under different label formats.
 *
 * Cause: the legacy `recordThrow()` is called from multiple paths
 * (ThrowLog POST, AthleteDrillLog POST, ThrowsBlockLog POST,
 * PracticeAttempt POST, manual PR entry) with inconsistent
 * `implementLabel` derivation. The same physical 14 lb hammer ends up as:
 *   - "14lbs"
 *   - "6.35kg"
 *   - "6.350300732098956kg"
 * — three distinct ThrowsPR rows because the unique key is
 * (athleteId, event, implement-string).
 *
 * Fix: for each (athleteId, event, ~kg-rounded) group with > 1 ThrowsPR
 * row, keep the max-distance row, rewrite its `implement` to the catalog's
 * `displayLabel` (or the cleanest input if no catalog match), and delete
 * the other rows.
 *
 * Safe: ThrowsPR is a derived/materialized table — its source data lives
 * in ThrowLog/AthleteDrillLog/etc. Deleting rows here cannot lose history.
 *
 *   --dry-run        (default) prints what would change, writes nothing
 *   --apply          actually writes; requires --confirm AND non-prod DB
 *                    (or env ALLOW_PROD_DEDUPE=true to override)
 *   --athlete <id>   scope to one athlete (staged rollout)
 *
 * Usage (prod):
 *   ALLOW_PROD_DEDUPE=true node --env-file=.env.local --import tsx \
 *     scripts/dedupe-legacy-throws-prs.ts --dry-run
 *
 *   ALLOW_PROD_DEDUPE=true node --env-file=.env.local --import tsx \
 *     scripts/dedupe-legacy-throws-prs.ts --apply --confirm
 */

import { PrismaClient, type ImplementType } from "@prisma/client";

const prisma = new PrismaClient();

const APPLY_CONFIRM_DELAY_MS = 10_000;
const KG_PER_LB = 0.45359237;
const KG_PER_GRAM = 0.001;

interface CliArgs {
  apply: boolean;
  confirm: boolean;
  athleteId: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { apply: false, confirm: false, athleteId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.apply = false;
    else if (a === "--apply") args.apply = true;
    else if (a === "--confirm") args.confirm = true;
    else if (a === "--athlete") args.athleteId = argv[++i] ?? null;
  }
  return args;
}

function looksLikeProd(): boolean {
  const url = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL ?? "";
  if (!url) return false;
  if (/(?:^|[@/])localhost[:/]/i.test(url)) return false;
  if (/(?:^|[@/])127\.0\.0\.1[:/]/i.test(url)) return false;
  if (/\.local[:/]/i.test(url)) return false;
  return true;
}

/**
 * Parse legacy implement labels into kg.
 *
 *   "7.26kg" → 7.26
 *   "14lbs"  → 6.35
 *   "16lb"   → 7.26
 *   "600g"   → 0.6
 *   "6.350300732098956kg" → 6.35 (parseFloat handles full precision)
 *   "5"      → 5 (assume kg if no suffix)
 */
function parseImplementToKg(label: string): number | null {
  const m = label
    .trim()
    .toLowerCase()
    .match(/^(-?\d+(?:\.\d+)?)\s*(kg|lbs?|g)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2];
  if (unit === "lb" || unit === "lbs") return n * KG_PER_LB;
  if (unit === "g") return n * KG_PER_GRAM;
  return n; // bare number or "kg" → kg
}

/** Round to 2dp for grouping (collapses "6.35" and "6.350300...kg"). */
function kgKey(kg: number): string {
  return (Math.round(kg * 100) / 100).toFixed(2);
}

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function implementTypeFromEvent(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") return event;
  return null;
}

interface DedupeStats {
  groups: number;
  rowsDeleted: number;
  rowsRelabeled: number;
}

interface AthleteRow {
  id: string;
  firstName: string;
  lastName: string;
}

async function dedupeAthlete(athlete: AthleteRow, apply: boolean): Promise<DedupeStats> {
  const stats: DedupeStats = { groups: 0, rowsDeleted: 0, rowsRelabeled: 0 };

  const prs = await prisma.throwsPR.findMany({
    where: { athleteId: athlete.id },
    orderBy: { distance: "desc" },
  });

  // Bucket by (event, kg-rounded-to-2dp).
  const buckets = new Map<string, typeof prs>();
  for (const pr of prs) {
    const kg = parseImplementToKg(pr.implement);
    if (kg == null) continue; // unparsable label → leave it alone
    const key = `${pr.event}|${kgKey(kg)}`;
    const existing = buckets.get(key) ?? [];
    existing.push(pr);
    buckets.set(key, existing);
  }

  for (const [key, rows] of buckets) {
    if (rows.length < 2) continue;
    stats.groups++;

    const [, kgStr] = key.split("|");
    const event = rows[0].event;
    const kg = parseFloat(kgStr);

    // Find catalog implement for canonical label (best effort — fall back
    // to whichever row has the cleanest legacy label if no catalog match).
    const throwType = implementTypeFromEvent(event);
    let canonicalLabel: string | null = null;
    if (throwType) {
      const candidate = await prisma.implement.findFirst({
        where: {
          throwType,
          weightKg: { gte: kg - 0.05, lte: kg + 0.05 },
          active: true,
        },
        // Prefer the implement whose primary unit matches the most-used
        // legacy label format. If labels are mostly "lbs", prefer the lb row.
        orderBy: { sortOrder: "asc" },
      });
      if (candidate) {
        // Prefer the unit that matches the majority of the legacy labels.
        const labelsLower = rows.map((r) => r.implement.toLowerCase());
        const lbCount = labelsLower.filter((l) => /lbs?/.test(l)).length;
        const preferLb = lbCount >= rows.length / 2;
        if (preferLb) {
          const lbCandidate = await prisma.implement.findFirst({
            where: {
              throwType,
              weightKg: { gte: kg - 0.05, lte: kg + 0.05 },
              primaryUnit: "lb",
              active: true,
            },
          });
          canonicalLabel = (lbCandidate ?? candidate).displayLabel;
        } else {
          const kgCandidate = await prisma.implement.findFirst({
            where: {
              throwType,
              weightKg: { gte: kg - 0.05, lte: kg + 0.05 },
              primaryUnit: "kg",
              active: true,
            },
          });
          canonicalLabel = (kgCandidate ?? candidate).displayLabel;
        }
      }
    }
    // Fallback: shortest label wins (proxies for "cleanest").
    if (!canonicalLabel) {
      canonicalLabel = [...rows].sort((a, b) => a.implement.length - b.implement.length)[0]
        .implement;
    }

    // Keep the row with the highest distance; ties broken by latest achievedAt.
    const sorted = [...rows].sort((a, b) => {
      if (b.distance !== a.distance) return b.distance - a.distance;
      return (b.achievedAt ?? "").localeCompare(a.achievedAt ?? "");
    });
    const winner = sorted[0];
    const losers = sorted.slice(1);

    const summary =
      `  ${athlete.firstName} ${athlete.lastName.padEnd(10)} ${event.padEnd(10)} ${canonicalLabel.padEnd(8)}  ` +
      `keep ${winner.distance}m (${winner.implement})  drop ${losers.map((l) => `${l.distance}m (${l.implement})`).join(", ")}`;
    console.log(summary);

    if (apply) {
      await prisma.$transaction(async (tx) => {
        if (winner.implement !== canonicalLabel) {
          await tx.throwsPR.update({
            where: { id: winner.id },
            data: { implement: canonicalLabel! },
          });
          stats.rowsRelabeled++;
        }
        await tx.throwsPR.deleteMany({
          where: { id: { in: losers.map((l) => l.id) } },
        });
        stats.rowsDeleted += losers.length;
      });
    } else {
      if (winner.implement !== canonicalLabel) stats.rowsRelabeled++;
      stats.rowsDeleted += losers.length;
    }
  }

  return stats;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("\nLegacy ThrowsPR dedupe\n" + "─".repeat(40));
  console.log(`Mode:  ${args.apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Scope: ${args.athleteId ? `athlete ${args.athleteId}` : "all athletes"}\n`);

  if (args.apply) {
    if (!args.confirm) {
      console.error("ERROR: --apply requires --confirm.");
      process.exit(1);
    }
    if (looksLikeProd() && process.env.ALLOW_PROD_DEDUPE !== "true") {
      console.error(
        "ERROR: DATABASE_URL appears to be production. Set ALLOW_PROD_DEDUPE=true to override."
      );
      process.exit(1);
    }
    console.log(
      `Waiting ${APPLY_CONFIRM_DELAY_MS / 1000}s before writing — Ctrl-C now to abort.\n`
    );
    await new Promise((r) => setTimeout(r, APPLY_CONFIRM_DELAY_MS));
  }

  const athletes = args.athleteId
    ? await prisma.athleteProfile.findMany({
        where: { id: args.athleteId },
        select: { id: true, firstName: true, lastName: true },
      })
    : await prisma.athleteProfile.findMany({
        select: { id: true, firstName: true, lastName: true },
        orderBy: { createdAt: "asc" },
      });

  let totalGroups = 0;
  let totalDeleted = 0;
  let totalRelabeled = 0;

  for (const athlete of athletes) {
    try {
      const s = await dedupeAthlete(athlete, args.apply);
      totalGroups += s.groups;
      totalDeleted += s.rowsDeleted;
      totalRelabeled += s.rowsRelabeled;
    } catch (err) {
      console.error(`✗ ${athlete.firstName} ${athlete.lastName} FAILED:`, err);
    }
  }

  console.log("\n" + "─".repeat(40));
  console.log(
    `TOTAL: ${totalGroups} duplicate groups → ${totalDeleted} rows deleted, ${totalRelabeled} rows relabeled`
  );
  if (!args.apply) console.log("\nDry run. Pass --apply --confirm to write.\n");
  else console.log("\nDone.\n");
}

main()
  .catch((err) => {
    console.error("Dedupe failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
