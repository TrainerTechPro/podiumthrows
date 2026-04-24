import { test, expect } from "@playwright/test";

/**
 * Bondarchuk descending-weight invariant — UI hard-block test.
 *
 * Vol IV p.114-117: ascending implement order (light → heavy) causes a 2-4m
 * performance decrease in natural athletes. The session builder must refuse
 * to save such a session, not just warn. This test builds a Throws + Lift
 * session with a 6kg → 8kg hammer sequence and asserts:
 *   1. The Save button is disabled.
 *   2. An inline critical error is rendered on one of the offending blocks
 *      (not just in the right-side ValidationPanel summary).
 */
test.describe("Coach throws builder — ascending weight hard-block", () => {
  test("6kg → 8kg hammer sequence disables Save and shows inline error", async ({ page }) => {
    await page.goto("/coach/throws/builder");
    await expect(page.getByRole("heading", { name: "Session Builder" })).toBeVisible();

    await page.getByPlaceholder(/HT Heavy Emphasis/i).fill("Test ascending sequence");

    // Quick Start: Throws + Lift → WARMUP, THROWING(idx=1), STRENGTH, THROWING(idx=3), COOLDOWN
    await page.getByRole("button", { name: /Quick Start: Throws \+ Lift/i }).click();

    const firstThrowing = page.locator("#builder-block-1");
    const secondThrowing = page.locator("#builder-block-3");
    await expect(firstThrowing).toBeVisible();
    await expect(secondThrowing).toBeVisible();

    // Implement dropdown is the first <select> inside each throwing block.
    await firstThrowing.locator("select").first().selectOption({ label: "6kg (light)" });
    await secondThrowing.locator("select").first().selectOption({ label: "8kg (heavy)" });

    // Save button hard-blocked
    const saveButton = page.getByRole("button", { name: /^Save Session$/ });
    await expect(saveButton).toBeDisabled();

    // Inline critical error rendered on the offending block (not summary-only).
    // Rule 1 flags blockIndices [1, 3]; both cards get the strip.
    const inlineError = page.getByTestId("block-critical-error-3");
    await expect(inlineError).toBeVisible();
    await expect(inlineError).toContainText(/Light-to-Heavy Sequence/i);
    await expect(inlineError).toContainText(/6kg.*8kg|8kg.*6kg/);
  });
});
