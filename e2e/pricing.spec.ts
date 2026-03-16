import { test, expect } from "@playwright/test";

test.describe("Pricing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
  });

  test("shows 3 plan tiers", async ({ page }) => {
    await expect(page.getByText("Free", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Elite", { exact: true }).first()).toBeVisible();
  });

  test("Free plan shows 3 athlete limit", async ({ page }) => {
    await expect(page.getByText("Up to 3 athletes")).toBeVisible();
  });

  test("Pro plan shows $100/month", async ({ page }) => {
    await expect(page.getByText("100")).toBeVisible();
  });

  test("Elite plan shows $199/month", async ({ page }) => {
    await expect(page.getByText("199")).toBeVisible();
  });

  test("CTA buttons are visible", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Get Started Free/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Start Pro/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Start Elite/i })).toBeVisible();
  });
});
