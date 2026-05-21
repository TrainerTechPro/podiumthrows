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
  test("athlete sees Danger zone in Account tab with disabled Delete forever", async ({ page }) => {
    // Delete + Export moved from Privacy → Account so destructive
    // ownership actions live where the user thinks of them ("manage my
    // account") instead of with the feed-sharing toggles.
    await loginAsAthlete(page);
    await page.goto("/athlete/settings?tab=account");

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
  test("unauthenticated DELETE /api/me is rejected", async ({ page }) => {
    // Middleware enforces CSRF before auth, so an unauthenticated mutation
    // without a CSRF header bounces at 403. With a valid CSRF header but
    // no session, the route returns 401. Both shapes are "denied" — assert
    // the boundary as a whole rather than coupling to ordering.
    await page.goto("/login"); // primes the csrf-token cookie
    const csrfToken =
      (await page.context().cookies()).find((c) => c.name === "csrf-token")?.value ?? "";
    const res = await page.request.delete("/api/me", {
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(res.status()).toBe(401);
  });

  test("coach with athletes is blocked with a 409 (no roster destruction)", async ({ page }) => {
    await login(page, COACH.email, COACH.password);
    const csrfToken =
      (await page.context().cookies()).find((c) => c.name === "csrf-token")?.value ?? "";
    const res = await page.request.delete("/api/me", {
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/athletes/i);
  });

  test("restore returns 409 when account isn't pending deletion", async ({ page }) => {
    await loginAsAthlete(page);
    const csrfToken =
      (await page.context().cookies()).find((c) => c.name === "csrf-token")?.value ?? "";
    const res = await page.request.post("/api/me/restore", {
      headers: { "X-CSRF-Token": csrfToken },
    });
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
