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
        /(auth|athlete-auth|landing|pricing|route-consolidation-redirects|coach-ia-redirects|athlete-onboarding-redirects|account-delete|data-export|analysis-overlay|calibration-wizard)\.spec\.ts/,
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
    {
      // Athlete mobile-daily-loop screenshot harness (UX audit 2). Same
      // pattern as canonical-screenshots — each test owns its viewport.
      // Logs in via API in each test, so no setup dependency (form-based
      // auth.setup.ts breaks in dev mode without an explicit JWT_SECRET).
      name: "athlete-mobile-loop",
      use: { ...devices["Desktop Chrome"] },
      fullyParallel: false,
      workers: 1,
      testMatch: /athlete-mobile-loop\.spec\.ts$/,
    },
    {
      // Mobile screenshots for the trust/setup surfaces (register, login,
      // onboarding, settings) at 375 + 390 widths. Verifies the auth-shell
      // iOS-zoom rule lands clean, and gives a baseline for setup-flow
      // visual regressions. Serial for the same DB-pool reason.
      name: "auth-onboarding-screenshots",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      fullyParallel: false,
      workers: 1,
      testMatch: /auth-onboarding-screenshots\.spec\.ts$/,
    },
    {
      // Data-surface screenshots — coach tables that collapse to cards on
      // mobile + athlete lists. Captures the structural shape of every
      // list/table at 390px + 1440px after the DataTable upgrade.
      name: "data-surfaces-screenshots",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      fullyParallel: false,
      workers: 1,
      testMatch: /data-surfaces-screenshots\.spec\.ts$/,
    },
    {
      // State-fixture screenshots — empty states + error boundary captures.
      // Same serial-workers pattern as the other screenshot projects.
      name: "state-fixtures-screenshots",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      fullyParallel: false,
      workers: 1,
      testMatch: /state-fixtures-screenshots\.spec\.ts$/,
    },
    {
      // Mobile keyboard-open screenshots — viewports shrunk to the height
      // available with the iOS keyboard occupying the bottom. Verifies
      // sticky CTAs + form actions remain reachable.
      name: "mobile-keyboard-screenshots",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      fullyParallel: false,
      workers: 1,
      testMatch: /mobile-keyboard-screenshots\.spec\.ts$/,
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
      // Disable Upstash rate-limit during e2e — falls back to in-memory
      // limiter (src/lib/rate-limit.ts) when both vars are empty. Otherwise
      // .env.local prod Upstash creds leak in and the login POST hangs
      // waiting on a cross-region Redis it can't reach.
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
      // Sentry: don't ship e2e test traffic to prod Sentry project.
      SENTRY_DSN: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
      // Pin JWT_SECRET so signing (auth.ts, node runtime) and verifying
      // (auth-edge.ts, edge runtime) agree. The dev fallbacks in those
      // two files DIFFER ("dev-secret-change-me" vs the edge hash), so
      // any flow that signs in Node and verifies in middleware would loop
      // back to /login if .env.local doesn't supply JWT_SECRET.
      JWT_SECRET: "e2e-fixed-jwt-secret-do-not-use-in-prod-7c4a9e1b3f2d5a8e",
    },
    timeout: 180_000,
  },
});
