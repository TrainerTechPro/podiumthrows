import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads without errors", async ({ page }) => {
    await expect(page).toHaveTitle(/Podium Throws/i);
    // Main heading should be visible
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("sign in link navigates to login", async ({ page }) => {
    await page.getByRole("link", { name: "Sign In" }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("privacy link is present with correct href", async ({ page }) => {
    const privacyLink = page.getByRole("link", { name: /Privacy/i });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute("href", /privacy/);
  });

  test("terms link is present with correct href", async ({ page }) => {
    const termsLink = page.getByRole("link", { name: /Terms/i });
    await expect(termsLink).toBeVisible();
    await expect(termsLink).toHaveAttribute("href", /terms/);
  });
});
