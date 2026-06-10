import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

/**
 * Stage-5 VERIFY: the canvas overlay player renders and frame-steps against
 * the committed real pose fixture (no auth — dev harness route).
 */

const FIXTURE = path.join(__dirname, "../services/pose/fixtures/fixture-pose.json");

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

test.describe("OverlayPlayer rendered-box mapping", () => {
  // Regression: keypoints used to be scaled onto a hardcoded 960px bitmap,
  // so on anything but the bitmap's own aspect the skeleton rendered at a
  // fraction of the athlete's size, anchored off-position.
  test.use({ viewport: { width: 390, height: 844 } });

  // Samples the canvas around the fixture keypoint's expected on-screen spot
  // (object-contain letterbox math from first principles) for drawn pixels.
  const probeKeypoint = (
    canvas: import("@playwright/test").Locator,
    args: { kp: { x: number; y: number }; sw: number; sh: number; tolerancePx: number }
  ) =>
    canvas.evaluate((el, { kp, sw, sh, tolerancePx }) => {
      const c = el as HTMLCanvasElement;
      const box = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const scale = Math.min(box.width / sw, box.height / sh);
      const offX = (box.width - sw * scale) / 2;
      const offY = (box.height - sh * scale) / 2;
      const ex = (offX + kp.x * scale) * dpr;
      const ey = (offY + kp.y * scale) * dpr;
      const r = Math.ceil(tolerancePx * dpr);
      const ctx = c.getContext("2d")!;
      const { data } = ctx.getImageData(Math.round(ex - r), Math.round(ey - r), 2 * r + 1, 2 * r + 1);
      let painted = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0 && (data[i - 3] > 60 || data[i - 2] > 60)) {
          painted = true;
          break;
        }
      }
      return {
        painted,
        bitmap: { w: c.width, h: c.height },
        box: { w: box.width, h: box.height },
        dpr,
      };
    }, args);

  test("fixture keypoint lands on its on-screen position in a portrait viewport", async ({
    page,
  }) => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf-8"));
    const { width: sw, height: sh } = fixture.resolution;
    const kps: Array<{ x: number; y: number; conf: number }> = fixture.frames[0].keypoints;
    const kp = kps.reduce((a, b) => (b.conf > a.conf ? b : a));

    await page.goto("/dev/overlay-preview");
    const canvas = page.getByTestId("overlay-canvas");
    await expect(canvas).toBeVisible();

    // ±6px window: absorbs the temporal smoothing the preview page applies
    // on top of the raw fixture while still failing for any scaling bug.
    await expect
      .poll(async () => (await probeKeypoint(canvas, { kp, sw, sh, tolerancePx: 6 })).painted, {
        timeout: 15_000,
      })
      .toBe(true);

    // Canvas bitmap derives from the rendered box × devicePixelRatio.
    const probe = await probeKeypoint(canvas, { kp, sw, sh, tolerancePx: 6 });
    expect(Math.abs(probe.bitmap.w - probe.box.w * probe.dpr)).toBeLessThanOrEqual(1);
    expect(Math.abs(probe.bitmap.h - probe.box.h * probe.dpr)).toBeLessThanOrEqual(1);

    // Rotate to landscape: ResizeObserver must remap without a frame change.
    await page.setViewportSize({ width: 844, height: 390 });
    await expect
      .poll(async () => {
        const after = await probeKeypoint(canvas, { kp, sw, sh, tolerancePx: 6 });
        return (
          after.painted && Math.abs(after.bitmap.w - after.box.w * after.dpr) <= 1
        );
      }, { timeout: 10_000 })
      .toBe(true);
  });
});
