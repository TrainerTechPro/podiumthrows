import { test, expect } from "@playwright/test";
import { loginAsAthlete, ATHLETE_1 } from "./helpers/auth";

test.describe("Athlete Authentication", () => {
  test("athlete login redirects to athlete surface", async ({ page }) => {
    await loginAsAthlete(page);
    // Athlete should land on /athlete/* (dashboard, onboarding, or hub depending on state)
    await expect(page).toHaveURL(/\/athlete\//);
  });

  test("athlete dashboard shows personalized greeting", async ({ page }) => {
    await loginAsAthlete(page);
    await page.goto("/athlete/dashboard");
    await expect(page).toHaveURL(/\/athlete\/dashboard/);
    // Greeting format: "Morning, Jordan" / "Afternoon, Jordan" etc. (see athlete/dashboard/page.tsx)
    await expect(page.locator("body")).toContainText(
      /(Morning|Afternoon|Evening|Late night), Jordan/
    );
  });

  test("unauthenticated access to athlete dashboard redirects to login", async ({ page }) => {
    await page.goto("/athlete/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("athlete cannot access coach dashboard", async ({ page }) => {
    await loginAsAthlete(page);
    await page.goto("/coach/dashboard");
    // Coach routes require COACH role — should redirect away
    await expect(page).not.toHaveURL(/\/coach\/dashboard/, { timeout: 10000 });
  });

  test("login with bad athlete password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ATHLETE_1.email);
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("body")).toContainText("Invalid email or password");
    await expect(page).toHaveURL(/\/login/);
  });
});
