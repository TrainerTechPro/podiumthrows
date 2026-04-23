import { execFileSync } from "child_process";
import { ensureThrowsAssignmentForAthlete1 } from "./helpers/seed-e2e";

/**
 * Pre-flight sanity check before any e2e test runs.
 *
 * Exists because the 2026-04-21 incident had Playwright's webServer
 * inheriting .env.local (production Supabase) and mutating prod data.
 *
 * The config-level env override is the primary defense; this is the
 * second layer: refuse to proceed unless the DB Playwright is about to
 * use is local AND has the seeded test accounts.
 *
 * Also ensures e2e-only fixtures that aren't part of the main db:seed
 * (e.g. a ThrowsAssignment for the redirect-coverage specs) exist.
 */
export default async function globalSetup() {
  const url =
    process.env.E2E_DATABASE_URL ??
    "postgresql://anthonysommers@localhost:5432/podium_throws?schema=public";

  if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
    throw new Error(`[e2e] Refusing to run against non-local DB: ${maskUrl(url)}`);
  }

  // psql doesn't accept Prisma-specific query params like ?schema=public
  const psqlUrl = url.split("?")[0];

  let seededEmails = "";
  try {
    seededEmails = execFileSync(
      "psql",
      [
        psqlUrl,
        "-tAc",
        `SELECT string_agg(email, ',') FROM "User" WHERE email IN ('coach@example.com', 'athlete1@example.com')`,
      ],
      { encoding: "utf8", timeout: 10_000 }
    ).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[e2e] Cannot reach local DB ${maskUrl(url)}. Is Postgres running?\n` +
        `  Try: brew services start postgresql@14\n  Detail: ${msg}`
    );
  }

  const found = seededEmails.split(",").filter(Boolean);
  if (found.length < 2) {
    throw new Error(
      `[e2e] Local DB is missing seeded test accounts (found: ${found.join(", ") || "none"}). ` +
        `Run: npm run db:seed`
    );
  }

  // Idempotent — only writes if the fixture IDs aren't already present.
  // Guarded by the same LOCAL-only check that lives in the helper module.
  ensureThrowsAssignmentForAthlete1();
}

function maskUrl(url: string): string {
  return url.replace(/:[^:/@]+@/, ":***@");
}
