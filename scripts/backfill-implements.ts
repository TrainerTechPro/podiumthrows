/* eslint-disable no-console -- backfill script uses console.log for progress reporting */
/**
 * One-time backfill: assign ThrowLog.implementId from the existing
 * (implementWeight, implementWeightUnit, implementWeightOriginal) triple.
 *
 * Reality is friendlier than the original spec assumed: ThrowLog already
 * stores the user's typed unit, so most rows are unambiguous. The script
 * uses the per-throw unit as the primary hint and falls back to a per-athlete
 * majority hint only when a row's unit is absent.
 *
 *   --dry-run       (default) prints what it would do, writes nothing
 *   --apply         actually writes; requires --confirm AND non-prod DB
 *                   (or env ALLOW_PROD_BACKFILL=true to override)
 *   --athlete <id>  scope to one athlete (staged rollout)
 *
 * Each athlete is wrapped in its own transaction — partial failure of one
 * athlete does not poison others. Rerunning --apply with no catalog/data
 * changes produces zero updates (idempotent).
 *
 * Audit rows are written to ThrowLogBackfillAudit for every assignment AND
 * every ambiguous/none case, so the Fix Old Throws UI can surface unresolved
 * rows.
 *
 * Usage:
 *   POSTGRES_PRISMA_URL="postgresql://anthonysommers@localhost:5432/podium_throws" \
 *     POSTGRES_URL_NON_POOLING="postgresql://anthonysommers@localhost:5432/podium_throws" \
 *     npx tsx scripts/backfill-implements.ts --dry-run
 *
 *   ... --apply --confirm
 *   ... --apply --confirm --athlete <athleteId>
 */

import { PrismaClient, type Prisma, type ImplementType } from "@prisma/client";
import { findCatalogMatchForWeight, recomputeManyPRs, type PrismaTx } from "../src/lib/implements";

const prisma = new PrismaClient();

const APPLY_CONFIRM_DELAY_MS = 10_000;

interface CliArgs {
  apply: boolean;
  confirm: boolean;
  athleteId: string | null;
}

interface AthleteSummary {
  athleteId: string;
  athleteName: string;
  exact: number;
  tolerated: number;
  ambiguous: number;
  none: number;
  alreadyAssigned: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { apply: false, confirm: false, athleteId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.apply = false;
    else if (a === "--apply") args.apply = true;
    else if (a === "--confirm") args.confirm = true;
    else if (a === "--athlete") {
      args.athleteId = argv[++i] ?? null;
    }
  }
  return args;
}

/** Returns true when DATABASE_URL appears to point at a production target. */
function looksLikeProd(): boolean {
  const url = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL ?? "";
  if (!url) return false;
  // Heuristic: localhost / 127.0.0.1 / *.local are non-prod. Anything else
  // (Supabase, RDS, Vercel Postgres) is prod by default.
  if (/(?:^|[@/])localhost[:/]/i.test(url)) return false;
  if (/(?:^|[@/])127\.0\.0\.1[:/]/i.test(url)) return false;
  if (/\.local[:/]/i.test(url)) return false;
  return true;
}

/** EventType (SHOT_PUT) → ImplementType (SHOT). */
function implementTypeFromEvent(event: string): ImplementType | null {
  if (event === "SHOT_PUT") return "SHOT";
  if (event === "HAMMER" || event === "DISCUS" || event === "JAVELIN") {
    return event;
  }
  return null;
}

interface PerThrowHint {
  unitSystem?: "metric" | "imperial";
}

function hintFromUnit(unit: string | null | undefined): PerThrowHint {
  if (unit === "lbs" || unit === "lb") return { unitSystem: "imperial" };
  if (unit === "kg") return { unitSystem: "metric" };
  return {};
}

/**
 * Scan an athlete's throws once to compute a fallback unit hint when the
 * per-row unit is missing. 80%+ on lb-grid (whole pounds within 0.01) →
 * "imperial"; 80%+ on kg-grid (multiples of 0.25 within 0.01) → "metric".
 */
async function computeAthleteFallbackHint(athleteId: string): Promise<PerThrowHint> {
  const KG_PER_LB = 0.45359237;
  const rows = await prisma.throwLog.findMany({
    where: { athleteId, implementWeight: { not: 0 } },
    select: { implementWeight: true },
  });
  if (rows.length === 0) return {};
  let lbCount = 0;
  let kgCount = 0;
  for (const r of rows) {
    const lb = r.implementWeight / KG_PER_LB;
    const onLb = Math.abs(lb - Math.round(lb)) < 0.01;
    const quarter = r.implementWeight / 0.25;
    const onKg = Math.abs(quarter - Math.round(quarter)) < 0.01;
    if (onLb && !onKg) lbCount++;
    else if (onKg && !onLb) kgCount++;
  }
  if (lbCount / rows.length >= 0.8) return { unitSystem: "imperial" };
  if (kgCount / rows.length >= 0.8) return { unitSystem: "metric" };
  return {};
}

interface ThrowsRow {
  id: string;
  athleteId: string;
  event: string;
  implementWeight: number;
  implementWeightUnit: string | null;
  implementWeightOriginal: number | null;
}

async function backfillAthlete(
  athleteId: string,
  athleteName: string,
  apply: boolean
): Promise<AthleteSummary> {
  const summary: AthleteSummary = {
    athleteId,
    athleteName,
    exact: 0,
    tolerated: 0,
    ambiguous: 0,
    none: 0,
    alreadyAssigned: 0,
  };

  const fallbackHint = await computeAthleteFallbackHint(athleteId);

  // ── Source 1: ThrowLog ────────────────────────────────────────────────────
  const unassignedThrowLogs = await prisma.throwLog.findMany({
    where: { athleteId, implementId: null },
    select: {
      id: true,
      athleteId: true,
      event: true,
      implementWeight: true,
      implementWeightUnit: true,
      implementWeightOriginal: true,
    },
  });

  // ── Source 2: AthleteDrillLog (joined via session.athleteId) ──────────────
  const unassignedDrillLogs = await prisma.athleteDrillLog.findMany({
    where: {
      session: { athleteId },
      implementId: null,
      implementWeight: { not: null, gt: 0 },
    },
    select: {
      id: true,
      implementWeight: true,
      implementWeightUnit: true,
      implementWeightOriginal: true,
      session: { select: { event: true } },
    },
  });

  // Already-assigned tally for the report.
  summary.alreadyAssigned =
    (await prisma.throwLog.count({ where: { athleteId, implementId: { not: null } } })) +
    (await prisma.athleteDrillLog.count({
      where: { session: { athleteId }, implementId: { not: null } },
    }));

  if (unassignedThrowLogs.length === 0 && unassignedDrillLogs.length === 0) {
    return summary;
  }

  // Normalize drill logs into the same ThrowsRow shape so processBatch can
  // handle both. Tag with __source so the writer knows which table to update.
  type DrillBatchRow = ThrowsRow & { __source: "drill" };
  const drillRows: DrillBatchRow[] = unassignedDrillLogs
    .filter((d): d is typeof d & { implementWeight: number } => d.implementWeight != null)
    .map((d) => ({
      id: d.id,
      athleteId,
      event: d.session.event,
      implementWeight: d.implementWeight,
      implementWeightUnit: d.implementWeightUnit,
      implementWeightOriginal: d.implementWeightOriginal,
      __source: "drill" as const,
    }));

  if (apply) {
    await prisma.$transaction(
      async (tx) => {
        const throwLogTargets = await processBatch(
          tx,
          unassignedThrowLogs,
          fallbackHint,
          summary,
          true,
          "throwLog"
        );
        const drillTargets = await processBatch(
          tx,
          drillRows,
          fallbackHint,
          summary,
          true,
          "drill"
        );
        const allTargets = [...throwLogTargets, ...drillTargets];
        await recomputeManyPRs(tx, allTargets);

        // After recompute, sync isPersonalBest flags on ThrowLog (drill rows
        // have no isPersonalBest column — best is tracked via PR row only).
        const seenCombos = new Set<string>();
        for (const target of allTargets) {
          const key = `${target.athleteId}|${target.implementId}`;
          if (seenCombos.has(key)) continue;
          seenCombos.add(key);

          const pr = await tx.athleteImplementPR.findUnique({
            where: { athleteId_implementId: target },
            select: { bestThrowLogId: true },
          });
          await tx.throwLog.updateMany({
            where: {
              athleteId: target.athleteId,
              implementId: target.implementId,
              isPersonalBest: true,
            },
            data: { isPersonalBest: false },
          });
          if (pr?.bestThrowLogId) {
            // bestThrowLogId may now reference an AthleteDrillLog id — try
            // updating ThrowLog (no-op if not found, so safe).
            await tx.throwLog.updateMany({
              where: { id: pr.bestThrowLogId },
              data: { isPersonalBest: true },
            });
          }
        }
      },
      { timeout: 60_000, maxWait: 10_000 }
    );
  } else {
    await processBatch(prisma, unassignedThrowLogs, fallbackHint, summary, false, "throwLog");
    await processBatch(prisma, drillRows, fallbackHint, summary, false, "drill");
  }

  return summary;
}

/**
 * Walks a batch of unassigned throws, computes the catalog match, optionally
 * writes (only if `apply`), and returns the (athlete, implement) tuples that
 * need PR recompute.
 */
async function processBatch(
  client: PrismaClient | PrismaTx,
  rows: ThrowsRow[],
  fallbackHint: PerThrowHint,
  summary: AthleteSummary,
  apply: boolean,
  source: "throwLog" | "drill" = "throwLog"
): Promise<{ athleteId: string; implementId: string }[]> {
  const recomputeTargets: { athleteId: string; implementId: string }[] = [];

  for (const row of rows) {
    const throwType = implementTypeFromEvent(row.event);
    if (!throwType) {
      summary.none++;
      if (apply) await writeAuditNone(client, row, "none");
      continue;
    }

    const perThrowHint = hintFromUnit(row.implementWeightUnit);
    const hint = perThrowHint.unitSystem ? perThrowHint : fallbackHint;

    const match = await findCatalogMatchForWeight(row.implementWeight, throwType, hint);

    if (match.kind === "exact" || match.kind === "tolerated") {
      if (match.kind === "exact") summary.exact++;
      else summary.tolerated++;

      if (apply) {
        if (source === "throwLog") {
          await (client as PrismaTx).throwLog.update({
            where: { id: row.id },
            data: { implementId: match.implement.id },
          });
          // Audit table targets ThrowLog rows by FK; only record audit for that source.
          await writeAuditAssigned(client, row, match.implement.id, match.deltaKg, match.kind);
        } else {
          await (client as PrismaTx).athleteDrillLog.update({
            where: { id: row.id },
            data: { implementId: match.implement.id },
          });
          // Drill rows aren't audited (the audit table is keyed by throwLogId).
          // The implementId itself is the durable record of the assignment.
        }
        recomputeTargets.push({ athleteId: row.athleteId, implementId: match.implement.id });
      }
    } else if (match.kind === "ambiguous") {
      summary.ambiguous++;
      if (apply && source === "throwLog") {
        await writeAuditAmbiguous(
          client,
          row,
          match.candidates.map((c) => c.id)
        );
      }
    } else {
      summary.none++;
      if (apply && source === "throwLog") {
        await writeAuditNone(client, row, "none");
      }
    }
  }

  return recomputeTargets;
}

async function writeAuditAssigned(
  client: PrismaClient | PrismaTx,
  row: ThrowsRow,
  implementId: string,
  deltaKg: number,
  kind: "exact" | "tolerated"
) {
  await (client as PrismaTx).throwLogBackfillAudit.upsert({
    where: { throwLogId: row.id },
    create: {
      throwLogId: row.id,
      beforeWeightKg: row.implementWeight,
      beforeUnit: row.implementWeightUnit,
      beforeOriginal: row.implementWeightOriginal,
      assignedImplementId: implementId,
      deltaKg,
      kind,
    },
    update: {
      beforeWeightKg: row.implementWeight,
      beforeUnit: row.implementWeightUnit,
      beforeOriginal: row.implementWeightOriginal,
      assignedImplementId: implementId,
      deltaKg,
      kind,
      runAt: new Date(),
    },
  });
}

async function writeAuditAmbiguous(
  client: PrismaClient | PrismaTx,
  row: ThrowsRow,
  candidateIds: string[]
) {
  await (client as PrismaTx).throwLogBackfillAudit.upsert({
    where: { throwLogId: row.id },
    create: {
      throwLogId: row.id,
      beforeWeightKg: row.implementWeight,
      beforeUnit: row.implementWeightUnit,
      beforeOriginal: row.implementWeightOriginal,
      kind: "ambiguous",
      candidateIds: candidateIds as Prisma.InputJsonValue,
    },
    update: {
      beforeWeightKg: row.implementWeight,
      beforeUnit: row.implementWeightUnit,
      beforeOriginal: row.implementWeightOriginal,
      kind: "ambiguous",
      candidateIds: candidateIds as Prisma.InputJsonValue,
      runAt: new Date(),
    },
  });
}

async function writeAuditNone(client: PrismaClient | PrismaTx, row: ThrowsRow, kind: "none") {
  await (client as PrismaTx).throwLogBackfillAudit.upsert({
    where: { throwLogId: row.id },
    create: {
      throwLogId: row.id,
      beforeWeightKg: row.implementWeight,
      beforeUnit: row.implementWeightUnit,
      beforeOriginal: row.implementWeightOriginal,
      kind,
    },
    update: {
      beforeWeightKg: row.implementWeight,
      beforeUnit: row.implementWeightUnit,
      beforeOriginal: row.implementWeightOriginal,
      kind,
      runAt: new Date(),
    },
  });
}

/* ─── Main ──────────────────────────────────────────────────────────────── */

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("\nImplement catalog backfill\n" + "─".repeat(40));
  console.log(`Mode:    ${args.apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Scope:   ${args.athleteId ? `athlete ${args.athleteId}` : "all athletes"}`);
  console.log("");

  if (args.apply) {
    if (!args.confirm) {
      console.error("ERROR: --apply requires --confirm. Aborting.");
      process.exit(1);
    }
    if (looksLikeProd() && process.env.ALLOW_PROD_BACKFILL !== "true") {
      console.error(
        "ERROR: DATABASE_URL appears to point at a production database. " +
          "Set ALLOW_PROD_BACKFILL=true if you really mean to run against prod. " +
          "Aborting."
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

  if (athletes.length === 0) {
    console.log("No athletes found.");
    return;
  }

  const totals: AthleteSummary = {
    athleteId: "",
    athleteName: "TOTAL",
    exact: 0,
    tolerated: 0,
    ambiguous: 0,
    none: 0,
    alreadyAssigned: 0,
  };

  for (const athlete of athletes) {
    const name = `${athlete.firstName} ${athlete.lastName}`;
    try {
      const summary = await backfillAthlete(athlete.id, name, args.apply);
      const hasWork = summary.exact + summary.tolerated + summary.ambiguous + summary.none > 0;
      if (hasWork) {
        console.log(
          `  ${args.apply ? "✓" : "·"} ${name.padEnd(28)} ` +
            `exact=${summary.exact}  tolerated=${summary.tolerated}  ` +
            `ambiguous=${summary.ambiguous}  none=${summary.none}  ` +
            `(already=${summary.alreadyAssigned})`
        );
      }
      totals.exact += summary.exact;
      totals.tolerated += summary.tolerated;
      totals.ambiguous += summary.ambiguous;
      totals.none += summary.none;
      totals.alreadyAssigned += summary.alreadyAssigned;
    } catch (err) {
      console.error(`  ✗ ${name} FAILED — skipping. Error:`, err);
    }
  }

  console.log("\n" + "─".repeat(40));
  console.log(
    `TOTAL: exact=${totals.exact}  tolerated=${totals.tolerated}  ` +
      `ambiguous=${totals.ambiguous}  none=${totals.none}  ` +
      `already=${totals.alreadyAssigned}`
  );
  if (!args.apply) {
    console.log("\nThis was a dry run. Pass --apply --confirm to write.\n");
  } else {
    console.log("\nDone.\n");
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
