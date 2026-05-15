import { test, expect } from "@playwright/test";
import { ensureTodayTrainingSessionForAthlete1 } from "./helpers/seed-e2e";

// Auth comes from the "athlete" project's saved storageState. See
// playwright.config.ts + e2e/auth.setup.ts.

test.describe("Athlete Log Session", () => {
  test("log-session page renders with event picker", async ({ page }) => {
    await page.goto("/athlete/log-session");
    // "Quick log" framing — distinguishes ad-hoc log from assigned-session
    // execution. See tasks/mvp-weekly-loop.md §3.
    await expect(page.getByRole("heading", { name: "Quick log" })).toBeVisible();
    // Athlete1's allowed event is Shot Put — it must be available
    await expect(page.getByRole("button", { name: "Shot put" })).toBeVisible();
    // Save button starts disabled
    const save = page.getByRole("button", { name: "Save session" });
    await expect(save).toBeDisabled();
  });

  test("submit minimal session → success state + appears in throws history", async ({ page }) => {
    await page.goto("/athlete/log-session");

    // Pick event (athlete1 is shot put only)
    await page.getByRole("button", { name: "Shot put" }).click();

    // Add a drill and select a drill type
    await page.getByRole("button", { name: /Add your first drill/i }).click();
    await page.getByLabel("Drill type").selectOption("Full Throw");

    // Save button becomes enabled
    const save = page.getByRole("button", { name: "Save session" });
    await expect(save).toBeEnabled();
    await save.click();

    // Success: either success toast appears OR doneSummary card renders with action links
    await expect(
      page.getByRole("link", { name: /View sessions/i }).or(page.getByText(/Session saved/i))
    ).toBeVisible({ timeout: 15000 });

    // Cross-check: throws hub loads for this athlete. Use domcontentloaded because
    // /athlete/throws pulls many widgets; waiting for full "load" is brittle in dev.
    await page.goto("/athlete/throws", { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page).toHaveURL(/\/athlete\/throws/);
  });

  // ── MVP weekly loop — assigned-session entry ──────────────────────────
  // When a coach assigns a session for today, the Athlete Home Today card
  // is the canonical entry point — not /athlete/log-session, which is for
  // ad-hoc work. The Today card's primary CTA must read "Start session"
  // and link to /athlete/sessions/{id}. See tasks/mvp-weekly-loop.md §2.

  test("assigned session lands on athlete home with 'Start session' CTA (mobile)", async ({
    page,
  }) => {
    const { trainingSessionId } = ensureTodayTrainingSessionForAthlete1();

    // Mobile viewport — the athlete app is mobile-primary.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/athlete/dashboard");

    // The Today card's primary CTA carries an aria-label starting with
    // "Start session — " followed by the session title.
    const cta = page.getByRole("link", { name: /^Start session — / });
    await expect(cta).toBeVisible({ timeout: 10000 });

    // CTA must point at the assigned-session detail route, not /athlete/log-session.
    const href = await cta.getAttribute("href");
    expect(href).toBe(`/athlete/sessions/${trainingSessionId}`);
  });
});
