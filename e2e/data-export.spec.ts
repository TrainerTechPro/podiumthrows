import { test, expect } from "@playwright/test";
import { loginAsAthlete, login, COACH } from "./helpers/auth";

/**
 * P0-8 — verifies the "Download my data" affordance on both products and
 * the JSON envelope returned by GET /api/me/export. Hits the API
 * directly via request.get() (rather than triggering the file download)
 * so we can assert response shape and headers.
 */
test.describe("Data export — athlete", () => {
  test("Privacy tab surfaces a Download my data button", async ({ page }) => {
    await loginAsAthlete(page);
    await page.goto("/athlete/settings?tab=privacy");
    await expect(page.getByRole("button", { name: /Download my data/i })).toBeVisible();
    await expect(page.getByText(/Other athletes' data is never included/i)).toBeVisible();
  });

  test("GET /api/me/export returns the canonical envelope", async ({ page }) => {
    await loginAsAthlete(page);
    const res = await page.request.get("/api/me/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/application\/json/);
    expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="podium-export-/);

    const body = await res.json();
    expect(body._meta).toMatchObject({
      role: "ATHLETE",
      schemaVersion: 1,
    });
    expect(body._meta.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.data).toHaveProperty("user");
    expect(body.data).toHaveProperty("athleteProfile");
    expect(body.data.user.passwordHash).toBe("[REDACTED]");
  });
});

test.describe("Data export — coach", () => {
  test("Security tab surfaces a Download my data button", async ({ page }) => {
    await login(page, COACH.email, COACH.password);
    await page.goto("/coach/settings?tab=security");
    await expect(page.getByRole("button", { name: /Download my data/i })).toBeVisible();
    await expect(page.getByText(/Athletes export their own data/i)).toBeVisible();
  });

  test("GET /api/me/export returns the coach envelope", async ({ page }) => {
    await login(page, COACH.email, COACH.password);
    const res = await page.request.get("/api/me/export");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body._meta.role).toBe("COACH");
    expect(body.data).toHaveProperty("coachProfile");
    expect(body.data).toHaveProperty("roster");
  });
});

test.describe("Data export — auth + rate limit", () => {
  test("unauthenticated request returns 401", async ({ request }) => {
    const res = await request.get("/api/me/export");
    expect(res.status()).toBe(401);
  });
});
