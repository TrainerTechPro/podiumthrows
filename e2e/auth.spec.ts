import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Authentication", () => {
  test("login with valid credentials redirects to coach dashboard", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/coach\/dashboard/);
    // Dashboard should show a greeting
    await expect(page.locator("body")).toContainText("Good");
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("coach@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator("body")).toContainText("Invalid email or password");
    await expect(page).toHaveURL(/\/login/);
  });

  test("register new coach lands on onboarding", async ({ page }) => {
    const uniqueEmail = `e2e-coach-${Date.now()}@test.com`;
    await page.goto("/register");
    // Step 1: select Coach role
    await page.getByRole("button", { name: /Coach/i }).click();
    // Step 2: fill registration form
    await page.getByLabel("First Name").fill("E2E");
    await page.getByLabel("Last Name").fill("Coach");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password", { exact: true }).fill("TestPass123!");
    await page.getByLabel("Confirm Password").fill("TestPass123!");
    await page.getByRole("button", { name: "Create Account" }).click();
    // Should redirect to onboarding or dashboard
    await page.waitForURL(
      (url) => url.pathname.includes("/coach/") || url.pathname.includes("/onboarding"),
      { timeout: 15000 }
    );
  });

  test("logout redirects to login", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/coach\/dashboard/);
    // Open user menu and click logout
    await page.getByRole("button", { name: /Log out|logout|user menu/i }).click();
    // If the above clicks the menu toggle, we need to find the logout button
    const logoutButton = page.getByRole("button", { name: /Log out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /coach/dashboard redirects to login", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
