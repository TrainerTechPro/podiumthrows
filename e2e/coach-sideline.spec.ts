import { test, expect, devices } from "@playwright/test";
import path from "path";

const COACH_STORAGE = path.resolve(__dirname, ".auth/coach.json");

const PHONE = devices["iPhone 14"];
const DESKTOP = devices["Desktop Chrome"];

/**
 * Coach sideline mobile flow.
 *
 * The sideline redirect lives in middleware: it triggers only when a
 * phone-class User-Agent hits /coach/dashboard without the
 * `coach_mobile_view=full` cookie. We exercise both halves here:
 *   - Phone UA → /coach/dashboard redirects to /coach/sideline.
 *   - Desktop UA → /coach/dashboard renders normally.
 *   - The "Full coach view" pill takes the coach to /coach/dashboard
 *     (sets cookie via server action) and the FAB returns them.
 *
 * Cookie writes go through the page-bound server action in
 * src/app/(dashboard)/coach/sideline/_actions.ts, so we don't need to set
 * cookies manually — the UI flow does it for us.
 */

test.describe("Coach sideline — phone viewport", () => {
  test.use({ ...PHONE, storageState: COACH_STORAGE });

  test("phone UA on /coach/dashboard redirects to /coach/sideline", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/coach\/sideline$/);
    await expect(page.getByText("Sideline", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's sessions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Roster quick-check" })).toBeVisible();
  });

  test("Full coach view pill sets cookie and routes to /coach/dashboard", async ({ page }) => {
    await page.goto("/coach/sideline");
    await page.getByRole("button", { name: /Full coach view/i }).click();
    await page.getByRole("button", { name: /Show full view/i }).click();
    await page.waitForURL(/\/coach\/dashboard$/);
    // Confirm the cookie was written by the server action.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "coach_mobile_view")?.value).toBe("full");
  });

  test("Return-to-sideline FAB appears on /coach/dashboard with cookie=full and routes back", async ({
    page,
  }) => {
    // Seed the cookie directly so we don't repeat the pill flow here.
    await page.context().addCookies([
      {
        name: "coach_mobile_view",
        value: "full",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/coach\/dashboard$/);

    const fab = page.getByRole("button", { name: "Return to sideline" });
    await expect(fab).toBeVisible();
    await fab.click();
    await page.waitForURL(/\/coach\/sideline$/);

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "coach_mobile_view")?.value).toBe("sideline");
  });
});

test.describe("Coach sideline — desktop viewport", () => {
  test.use({ ...DESKTOP, storageState: COACH_STORAGE });

  test("desktop UA on /coach/dashboard does NOT redirect", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/coach\/dashboard$/);
    // Editorial dashboard headline — proves the full coach shell is rendered.
    await expect(page.getByRole("heading", { name: "Your program, today." })).toBeVisible();
  });

  test("desktop FAB is hidden even when cookie=full", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "coach_mobile_view",
        value: "full",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/coach/dashboard");
    // FAB has md:hidden — should not be visible at desktop widths.
    await expect(page.getByRole("button", { name: "Return to sideline" })).toBeHidden();
  });
});
