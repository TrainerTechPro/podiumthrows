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

setup("authenticate as coach", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(COACH.email);
  await page.getByLabel("Password").fill(COACH.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/coach\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: COACH_STORAGE });
});

setup("authenticate as athlete", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ATHLETE_1.email);
  await page.getByLabel("Password").fill(ATHLETE_1.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/athlete\//, { timeout: 15000 });
  await page.context().storageState({ path: ATHLETE_STORAGE });
});
