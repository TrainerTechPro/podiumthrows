import path from "path";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests MUST run against a local Postgres, never production.
 * See memory/feedback_never_seed_production.md + the 2026-04-21 incident
 * where tests hit prod via .env.local because that file holds production
 * Supabase creds.
 *
 * Override with E2E_DATABASE_URL if your local DB differs. Default matches
 * the setup documented in CLAUDE.md §Dev Setup.
 */
const LOCAL_DB_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://anthonysommers@localhost:5432/podium_throws?schema=public";

if (!LOCAL_DB_URL.includes("localhost") && !LOCAL_DB_URL.includes("127.0.0.1")) {
  throw new Error(
    `E2E refusing to run against non-local DB: ${LOCAL_DB_URL.replace(/:[^:/@]+@/, ":***@")}`
  );
}

const COACH_STORAGE = path.resolve(__dirname, "e2e/.auth/coach.json");
const ATHLETE_STORAGE = path.resolve(__dirname, "e2e/.auth/athlete.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "no-auth",
      use: { ...devices["Desktop Chrome"] },
      // Login/logout + landing/pricing run without pre-saved auth state.
      // Serial because the app's login endpoint is rate-limited via upstash —
      // parallel login storms trigger 429s. Tests here are fast anyway.
      fullyParallel: false,
      testMatch:
        /(auth|athlete-auth|landing|pricing|route-consolidation-redirects|coach-ia-redirects|athlete-onboarding-redirects)\.spec\.ts/,
    },
    {
      name: "coach",
      use: { ...devices["Desktop Chrome"], storageState: COACH_STORAGE },
      dependencies: ["setup"],
      // Anchored with (^|/) so "session-redirects" in the athlete spec doesn't
      // trigger this project via substring match.
      testMatch:
        /(^|\/)(coach-dashboard|coach-roster-detail|coach-session-redirects|coach-sideline|coach-throws-builder)\.spec\.ts$/,
    },
    {
      name: "athlete",
      use: { ...devices["Desktop Chrome"], storageState: ATHLETE_STORAGE },
      dependencies: ["setup"],
      // Anchored so "coach-session-redirects.spec.ts" doesn't get pulled in
      // via the "session-redirects" alternative.
      testMatch:
        /(^|\/)(athlete-log-session|athlete-quick-log-pr|athlete-training-hub|session-redirects)\.spec\.ts$/,
    },
    {
      // Canonical-surface screenshot harness. Runs serially because 40
      // concurrent dev-server page renders overwhelms the local DB pool.
      // Each test spawns its own context with the appropriate storageState
      // and viewport, so project-level use/storageState don't matter here.
      name: "canonical-screenshots",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      fullyParallel: false,
      workers: 1,
      testMatch: /canonical-screenshots\.spec\.ts$/,
    },
  ],
  webServer: {
    command: "npm run dev",
    port: 3000,
    // Never reuse a dev server that may have been started with prod creds.
    // Slower, but structurally prevents cross-env contamination.
    reuseExistingServer: false,
    env: {
      POSTGRES_PRISMA_URL: LOCAL_DB_URL,
      POSTGRES_URL: LOCAL_DB_URL,
      POSTGRES_URL_NON_POOLING: LOCAL_DB_URL,
    },
    timeout: 120_000,
  },
});
