import { test, expect } from "@playwright/test";
import { loginAsAthlete, login, COACH } from "./helpers/auth";

/**
 * P0-9 — verifies the delete-my-account flow on both products without
 * ever actually deleting the seeded test accounts. The destructive
 * fetch is gated by a typed "DELETE" + the API enforces eligibility,
 * so coverage focuses on the gates, the 401/409 contract on the API,
 * and the surface presence — not on the irreversible action itself.
 */
test.describe("Account deletion — UI surface", () => {
  test("athlete sees Danger zone in Privacy tab with disabled Delete forever", async ({ page }) => {
    await loginAsAthlete(page);
    await page.goto("/athlete/settings?tab=privacy");

    await expect(page.getByText(/Danger zone/i)).toBeVisible();
    await page.getByRole("button", { name: "Delete my account" }).click();

    // Modal opens; "Delete forever" is disabled until DELETE is typed.
    const deleteForever = page.getByRole("button", { name: "Delete forever" });
    await expect(deleteForever).toBeDisabled();

    await page.getByLabel(/Type DELETE to confirm/i).fill("delete");
    await expect(deleteForever).toBeDisabled();

    await page.getByLabel(/Type DELETE to confirm/i).fill("DELETE");
    await expect(deleteForever).toBeEnabled();

    // Cancel out — never submit.
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("coach sees Danger zone in Security tab with the same gate", async ({ page }) => {
    await login(page, COACH.email, COACH.password);
    await page.goto("/coach/settings?tab=security");

    await expect(page.getByText(/Danger zone/i)).toBeVisible();
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByRole("button", { name: "Delete forever" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancel" }).click();
  });
});

test.describe("Account deletion — API contract", () => {
  test("unauthenticated DELETE /api/me returns 401", async ({ request }) => {
    const res = await request.delete("/api/me");
    expect(res.status()).toBe(401);
  });

  test("coach with athletes is blocked with a 409 (no roster destruction)", async ({ page }) => {
    await login(page, COACH.email, COACH.password);
    const res = await page.request.delete("/api/me");
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/athletes/i);
  });

  test("restore returns 409 when account isn't pending deletion", async ({ page }) => {
    await loginAsAthlete(page);
    const res = await page.request.post("/api/me/restore");
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/pending deletion|grace/i);
  });
});

test.describe("Account deletion — public pages", () => {
  test("/goodbye is reachable without auth", async ({ page }) => {
    await page.goto("/goodbye");
    await expect(page).toHaveURL(/\/goodbye/);
    await expect(page.getByText(/scheduled for deletion/i)).toBeVisible();
  });
});
