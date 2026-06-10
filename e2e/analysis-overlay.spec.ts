import { test, expect } from "@playwright/test";

/**
 * Stage-5 VERIFY: the canvas overlay player renders and frame-steps against
 * the committed real pose fixture (no auth — dev harness route).
 */

test.describe("OverlayPlayer smoke", () => {
  test("renders skeleton canvas and steps frames", async ({ page }) => {
    await page.goto("/dev/overlay-preview");

    const player = page.getByTestId("overlay-player");
    await expect(player).toBeVisible();
    const canvas = page.getByTestId("overlay-canvas");
    await expect(canvas).toBeVisible();

    // Canvas actually painted (some non-transparent pixels). Poll: the first
    // paint happens in a React effect after hydration.
    await expect
      .poll(
        () =>
          canvas.evaluate((el) => {
            const c = el as HTMLCanvasElement;
            const ctx = c.getContext("2d")!;
            const { data } = ctx.getImageData(0, 0, c.width, c.height);
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
            return false;
          }),
        { timeout: 15_000 }
      )
      .toBe(true);

    await expect(page.getByTestId("frame-readout")).toContainText("frame 0 /");
    await page.getByRole("button", { name: "Next frame" }).click();
    await expect(page.getByTestId("frame-readout")).toContainText("frame 1 /");
    await page.getByRole("button", { name: "Previous frame" }).click();
    await expect(page.getByTestId("frame-readout")).toContainText("frame 0 /");

    // Phase scrubber seeks.
    await page.getByLabel("Scrub frames").fill("30");
    await expect(page.getByTestId("frame-readout")).toContainText("frame 30 /");
  });
});
