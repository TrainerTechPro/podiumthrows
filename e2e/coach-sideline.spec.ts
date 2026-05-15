import { test, expect } from "@playwright/test";

// MVP surface cut (2026-05-15): /coach/sideline is flag-gated behind
// `coachSideline` (default off). The middleware also gates the phone-UA
// dashboard → sideline auto-redirect by the same flag. All describes below
// use .skip until sideline is reintroduced — re-enable by removing .skip
// once the flag flips back on.

/**
 * Coach sideline mobile flow.
 *
 * The redirect at /coach/dashboard is keyed off User-Agent only (phone-class
 * UA + cookie != "full"). Tests run in the project's default Chromium —
 * we toggle UA at the test level instead of switching devices, since
 * mixing devices in a describe forces a new worker.
 *
 *   - Phone UA → /coach/dashboard redirects to /coach/sideline.
 *   - Phone UA + cookie=full → /coach/dashboard does NOT redirect (opt-in lock).
 *   - Desktop UA → /coach/dashboard renders normally.
 *   - iPad UA → /coach/dashboard does NOT redirect (boundary; regex is narrow
 *     on purpose, see CLAUDE.md §Dual Product Identity).
 *   - "Full coach view" pill commits the cookie via server action.
 *   - FAB returns to sideline.
 */

const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const IPAD_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test.describe.skip("Coach sideline — phone UA", () => {
  test.use({ userAgent: PHONE_UA, viewport: { width: 390, height: 844 } });

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
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "coach_mobile_view")?.value).toBe("full");
  });

  test("Return-to-sideline FAB on /coach/dashboard with cookie=full and routes back", async ({
    page,
  }) => {
    await page
      .context()
      .addCookies([{ name: "coach_mobile_view", value: "full", domain: "localhost", path: "/" }]);
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/coach\/dashboard$/);

    const fab = page.getByRole("button", { name: "Return to sideline" });
    await expect(fab).toBeVisible();
    await fab.click();
    await page.waitForURL(/\/coach\/sideline$/);

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "coach_mobile_view")?.value).toBe("sideline");
  });

  test("phone UA with coach_mobile_view=full does NOT redirect from /coach/dashboard", async ({
    page,
  }) => {
    await page
      .context()
      .addCookies([{ name: "coach_mobile_view", value: "full", domain: "localhost", path: "/" }]);
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/coach\/dashboard$/);
  });
});

test.describe.skip("Coach sideline — desktop UA", () => {
  // Default Chromium UA is desktop — no override needed.

  test("desktop UA on /coach/dashboard does NOT redirect", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/coach\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Your program, today." })).toBeVisible();
  });

  test("desktop FAB is hidden even when cookie=full", async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: "coach_mobile_view", value: "full", domain: "localhost", path: "/" }]);
    await page.goto("/coach/dashboard");
    await expect(page.getByRole("button", { name: "Return to sideline" })).toBeHidden();
  });
});

test.describe.skip("Coach sideline — iPad UA boundary", () => {
  // PHONE_UA_RE excludes iPad on purpose (see CLAUDE.md §Dual Product Identity:
  // "not iPad-on-the-bench"). Locking the boundary so a future "fix" widening
  // the regex can't silently change the redirect contract.
  test.use({ userAgent: IPAD_UA, viewport: { width: 1024, height: 1366 } });

  test("iPad UA on /coach/dashboard does NOT redirect", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/coach\/dashboard$/);
  });
});
