import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";
import { COACH, ATHLETE_1 } from "./helpers/auth";

/**
 * Auth setup project — runs once before all test projects that need a
 * logged-in user. Saves each role's cookies to a file so subsequent
 * tests can skip login (and avoid hitting the rate limiter).
 *
 * The raw login flow is still exercised by e2e/auth.spec.ts and
 * e2e/athlete-auth.spec.ts which run in the no-auth project.
 */

const AUTH_DIR = path.resolve(__dirname, ".auth");
fs.mkdirSync(AUTH_DIR, { recursive: true });

export const COACH_STORAGE = path.join(AUTH_DIR, "coach.json");
export const ATHLETE_STORAGE = path.join(AUTH_DIR, "athlete.json");

// Cold-start budget: Next dev compiles /login → POST /api/auth/login → the
// redirect target on first hit. The default per-test 30s timeout was too
// tight for a from-cold build of /coach/dashboard. We bump the whole-test
// budget so the waitForURL has room without hiding real regressions. CI
// is faster since the build is pre-warmed.
const SETUP_TEST_TIMEOUT_MS = 120_000;
const AUTH_REDIRECT_TIMEOUT_MS = 90_000;

setup("authenticate as coach", async ({ page }) => {
  setup.setTimeout(SETUP_TEST_TIMEOUT_MS);
  await page.goto("/login");
  await page.getByLabel("Email").fill(COACH.email);
  await page.getByLabel("Password", { exact: true }).fill(COACH.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/coach\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT_MS });
  await page.context().storageState({ path: COACH_STORAGE });
});

setup("authenticate as athlete", async ({ page }) => {
  setup.setTimeout(SETUP_TEST_TIMEOUT_MS);
  await page.goto("/login");
  await page.getByLabel("Email").fill(ATHLETE_1.email);
  await page.getByLabel("Password", { exact: true }).fill(ATHLETE_1.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/athlete\//, { timeout: AUTH_REDIRECT_TIMEOUT_MS });
  await page.context().storageState({ path: ATHLETE_STORAGE });
});
