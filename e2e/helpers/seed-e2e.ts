import { execFileSync } from "child_process";

/**
 * Seed helpers for e2e scenarios that need records not created by the main
 * `npm run db:seed`. Idempotent — safe to run on every test invocation.
 *
 * All writes go through psql against the same local DB the Playwright
 * webServer uses. The LOCAL-only guard below mirrors global-setup.ts and
 * e2e/helpers/db.ts so a misconfigured env can't nuke prod.
 */

const LOCAL_DB_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://anthonysommers@localhost:5432/podium_throws?schema=public";

if (!LOCAL_DB_URL.includes("localhost") && !LOCAL_DB_URL.includes("127.0.0.1")) {
  throw new Error(`[e2e seed] Refusing to run against non-local DB`);
}

// psql doesn't accept Prisma-specific query params like ?schema=public
const PSQL_URL = LOCAL_DB_URL.split("?")[0];

function psqlQuery(sql: string): string[] {
  return execFileSync("psql", [PSQL_URL, "-tAc", sql], {
    encoding: "utf8",
    timeout: 10_000,
  })
    .trim()
    .split("\n")
    .filter(Boolean);
}

function psqlExec(sql: string): void {
  execFileSync("psql", [PSQL_URL, "-c", sql], {
    encoding: "utf8",
    timeout: 10_000,
  });
}

export const E2E_THROWS_SESSION_ID = "e2e-throws-session-1";
export const E2E_THROWS_ASSIGNMENT_ID = "e2e-throws-assignment-1";

/**
 * Ensure a ThrowsSession + ThrowsAssignment exist for athlete1@example.com.
 * Fixed IDs so multiple test runs don't multiply the rows. Status=ASSIGNED so
 * the page defaults to ?view=live on the /athlete/throws/[id] route.
 */
export function ensureThrowsAssignmentForAthlete1(): {
  throwsSessionId: string;
  throwsAssignmentId: string;
} {
  const coachRows = psqlQuery(
    `SELECT cp.id FROM "CoachProfile" cp JOIN "User" u ON cp."userId"=u.id WHERE u.email='coach@example.com' LIMIT 1`
  );
  if (coachRows.length === 0) {
    throw new Error("[e2e seed] coach@example.com not found — run npm run db:seed first");
  }
  const coachId = coachRows[0];

  const athleteRows = psqlQuery(
    `SELECT ap.id FROM "AthleteProfile" ap JOIN "User" u ON ap."userId"=u.id WHERE u.email='athlete1@example.com' LIMIT 1`
  );
  if (athleteRows.length === 0) {
    throw new Error("[e2e seed] athlete1@example.com not found — run npm run db:seed first");
  }
  const athleteId = athleteRows[0];

  psqlExec(
    `INSERT INTO "ThrowsSession" (id, "coachId", name, "sessionType", event, "createdAt", "updatedAt")
     VALUES ('${E2E_THROWS_SESSION_ID}', '${coachId}', 'E2E Fixture', 'THROWS_ONLY', 'SHOT_PUT', NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`
  );

  const today = new Date().toISOString().slice(0, 10);
  psqlExec(
    `INSERT INTO "ThrowsAssignment" (id, "sessionId", "athleteId", "assignedDate", status, "createdAt", "updatedAt")
     VALUES ('${E2E_THROWS_ASSIGNMENT_ID}', '${E2E_THROWS_SESSION_ID}', '${athleteId}', '${today}', 'ASSIGNED', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET status='ASSIGNED', "updatedAt"=NOW()`
  );

  return {
    throwsSessionId: E2E_THROWS_SESSION_ID,
    throwsAssignmentId: E2E_THROWS_ASSIGNMENT_ID,
  };
}

export const E2E_TODAY_TRAINING_SESSION_ID = "e2e-today-training-session-1";

/**
 * Ensure athlete1 has a TrainingSession scheduled for today (status=SCHEDULED).
 * This is what powers the Athlete Home "Today" hero card — see
 * tasks/mvp-weekly-loop.md §2.
 *
 * Idempotent: re-running updates the scheduledDate forward to "now" so the
 * "today" window in `loadAthleteDashboard()` continues to match it.
 */
export function ensureTodayTrainingSessionForAthlete1(): { trainingSessionId: string } {
  const athleteRows = psqlQuery(
    `SELECT ap.id FROM "AthleteProfile" ap JOIN "User" u ON ap."userId"=u.id WHERE u.email='athlete1@example.com' LIMIT 1`
  );
  if (athleteRows.length === 0) {
    throw new Error("[e2e seed] athlete1@example.com not found — run npm run db:seed first");
  }
  const athleteId = athleteRows[0];

  // Reuse the first existing WorkoutPlan so the relation is populated;
  // the Today card pulls plan.name + plan.blocks for the prescription.
  // If no plan exists, leave planId NULL — the page still renders.
  const planRows = psqlQuery(`SELECT id FROM "WorkoutPlan" ORDER BY "createdAt" ASC LIMIT 1`);
  const planClause = planRows.length > 0 ? `'${planRows[0]}'` : "NULL";

  psqlExec(
    `INSERT INTO "TrainingSession" (id, "planId", "athleteId", "scheduledDate", status, "createdAt", "updatedAt")
     VALUES ('${E2E_TODAY_TRAINING_SESSION_ID}', ${planClause}, '${athleteId}', NOW(), 'SCHEDULED', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET "scheduledDate"=NOW(), status='SCHEDULED', "updatedAt"=NOW()`
  );

  return { trainingSessionId: E2E_TODAY_TRAINING_SESSION_ID };
}

/**
 * Return the ID of a COMPLETED TrainingSession belonging to athlete1.
 * Seed creates 10 sessions for athlete1 (8 COMPLETED), so this should always
 * resolve — but throws a helpful error if the seed wasn't run.
 */
export function getCompletedTrainingSessionIdForAthlete1(): string {
  const rows = psqlQuery(
    `SELECT ts.id FROM "TrainingSession" ts
     JOIN "AthleteProfile" ap ON ts."athleteId"=ap.id
     JOIN "User" u ON ap."userId"=u.id
     WHERE u.email='athlete1@example.com' AND ts.status='COMPLETED'
     ORDER BY ts."scheduledDate" DESC LIMIT 1`
  );
  if (rows.length === 0) {
    throw new Error("[e2e seed] No COMPLETED TrainingSession for athlete1 — run npm run db:seed");
  }
  return rows[0];
}
