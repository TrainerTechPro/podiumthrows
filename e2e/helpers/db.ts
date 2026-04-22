import { execFileSync } from "child_process";

/**
 * Thin psql-based helpers for e2e test setup/teardown.
 * Uses the same URL Playwright's global-setup validated as local.
 */

function getLocalDbUrl(): string {
  const url =
    process.env.E2E_DATABASE_URL ??
    "postgresql://anthonysommers@localhost:5432/podium_throws?schema=public";
  if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
    throw new Error(`[e2e helpers/db] Refusing to run against non-local DB`);
  }
  return url.split("?")[0];
}

function psql<T = Record<string, string>>(sql: string): T[] {
  const out = execFileSync("psql", [getLocalDbUrl(), "-tAc", sql, "-F", "|"], {
    encoding: "utf8",
    timeout: 10_000,
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  return out as unknown as T[];
}

export function getAthleteIdByEmail(email: string): string {
  const rows = psql<string>(
    `SELECT ap.id FROM "AthleteProfile" ap JOIN "User" u ON ap."userId"=u.id WHERE u.email='${email.replace(/'/g, "''")}' LIMIT 1`
  );
  if (rows.length === 0) throw new Error(`No AthleteProfile for ${email}`);
  return rows[0];
}

export function upsertThrowsPR(args: {
  athleteId: string;
  event: string;
  implementKg: number;
  distance: number;
}): void {
  const { athleteId, event, implementKg, distance } = args;
  const implement = `${parseFloat(implementKg.toFixed(2))}kg`;
  const today = new Date().toISOString().slice(0, 10);
  psql(
    `INSERT INTO "ThrowsPR" (id, "athleteId", event, implement, distance, "achievedAt", source, "createdAt", "updatedAt")
     VALUES (
       'e2e_' || substr(md5(random()::text), 1, 20),
       '${athleteId}', '${event}', '${implement}', ${distance}, '${today}', 'TRAINING', NOW(), NOW()
     )
     ON CONFLICT ("athleteId", event, implement)
     DO UPDATE SET distance=EXCLUDED.distance, "achievedAt"=EXCLUDED."achievedAt", "updatedAt"=NOW()`
  );
}

export function deleteThrowsPR(args: {
  athleteId: string;
  event: string;
  implementKg: number;
}): void {
  const { athleteId, event, implementKg } = args;
  const implement = `${parseFloat(implementKg.toFixed(2))}kg`;
  psql(
    `DELETE FROM "ThrowsPR" WHERE "athleteId"='${athleteId}' AND event='${event}' AND implement='${implement}'`
  );
}

export function deleteThrowLogsInWindow(args: {
  athleteId: string;
  event: string;
  implementKg: number;
  sinceMinutes: number;
}): void {
  const { athleteId, event, implementKg, sinceMinutes } = args;
  psql(
    `DELETE FROM "ThrowLog"
     WHERE "athleteId"='${athleteId}'
       AND event='${event}'
       AND "implementWeight"=${implementKg}
       AND date > NOW() - INTERVAL '${sinceMinutes} minutes'`
  );
}
