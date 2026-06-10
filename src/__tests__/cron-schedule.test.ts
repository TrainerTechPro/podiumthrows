import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";

// A cron route that isn't in vercel.json never runs — Vercel only fires
// schedules listed there. requeue-stale-analysis shipped unscheduled, so
// stuck analysis jobs were never retried. This pins route dirs ↔ schedule.

const root = path.resolve(__dirname, "../..");
const cronDir = path.join(root, "src/app/api/cron");
const vercelConfig = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")) as {
  crons?: Array<{ path: string; schedule: string }>;
};

const scheduledPaths = (vercelConfig.crons ?? []).map((c) => c.path);
const routePaths = readdirSync(cronDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(cronDir, d.name, "route.ts")))
  .map((d) => `/api/cron/${d.name}`);

describe("vercel.json cron schedule", () => {
  it("schedules every /api/cron route", () => {
    const missing = routePaths.filter((r) => !scheduledPaths.includes(r));
    expect(missing).toEqual([]);
  });

  it("has no schedule pointing at a nonexistent route", () => {
    const orphaned = scheduledPaths.filter((p) => !routePaths.includes(p));
    expect(orphaned).toEqual([]);
  });

  it("uses valid five-field cron expressions", () => {
    for (const cron of vercelConfig.crons ?? []) {
      expect(cron.schedule.trim().split(/\s+/), cron.path).toHaveLength(5);
    }
  });
});
