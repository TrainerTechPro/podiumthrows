import { test, expect } from "@playwright/test";

/**
 * Stage-6 VERIFY: wizard renders and walks the full flow with camera and
 * gyro mocked. Two paths: gyro-granted (orientation events drive zones) and
 * gyro-denied (manual confirm fallback — F1: denial never blocks).
 */

function mockBrowserApis(page: import("@playwright/test").Page, gyro: "granted" | "denied") {
  return page.addInitScript((gyroMode) => {
    // Fake camera: a 16:9 canvas stream.
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    setInterval(() => {
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "rgb(40 60 40)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 100);
    const fakeStream = (canvas as HTMLCanvasElement).captureStream(10);
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: () => Promise.resolve(fakeStream),
      },
      configurable: true,
    });
    // Gyro: permission-gated like iOS Safari.
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent =
      class extends Event {
        alpha: number | null = null;
        beta: number | null = null;
        gamma: number | null = null;
        constructor(type: string, init?: { alpha?: number; beta?: number; gamma?: number }) {
          super(type);
          this.alpha = init?.alpha ?? null;
          this.beta = init?.beta ?? null;
          this.gamma = init?.gamma ?? null;
        }
        static requestPermission() {
          return Promise.resolve(gyroMode);
        }
      };
    // Silence speech.
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak: () => {}, cancel: () => {} },
      configurable: true,
    });
  }, gyro);
}

/**
 * Fire orientation samples until the wizard reflects the expected zone —
 * a single dispatch can race the listener attach after the permission grant.
 */
async function driveOrientationTo(
  page: import("@playwright/test").Page,
  beta: number,
  gamma: number,
  expectedZone: string
) {
  await expect
    .poll(
      async () => {
        await page.evaluate(
          ([b, g]) => {
            const Ctor = (
              window as unknown as { DeviceOrientationEvent: new (t: string, i: object) => Event }
            ).DeviceOrientationEvent;
            window.dispatchEvent(new Ctor("deviceorientation", { alpha: 0, beta: b, gamma: g }));
          },
          [beta, gamma]
        );
        return page.getByTestId("align-viewport").getAttribute("data-zone");
      },
      { timeout: 10_000 }
    )
    .toBe(expectedZone);
}

test.describe("CalibrationWizard smoke", () => {
  test("gyro-granted path: zones respond to orientation and lock captures", async ({ page }) => {
    await mockBrowserApis(page, "granted");
    await page.goto("/dev/calibration-wizard");

    await expect(page.getByTestId("calibration-wizard")).toBeVisible();
    await page.getByRole("button", { name: "Shot put" }).click();
    await expect(page.getByTestId("position-step")).toBeVisible();
    await expect(page.getByTestId("position-step")).toContainText("5 m");
    await page.getByRole("button", { name: "Tripod is placed" }).click();

    await expect(page.getByTestId("align-viewport")).toBeVisible();
    await page.getByRole("button", { name: "Enable level assist" }).click();

    // Misaligned: pitch 45° down (beta 45), roll 8°.
    await driveOrientationTo(page, 45, 8, "MISALIGNED");

    // Close: roll 2.5°, pitch 12° down (beta 78).
    await driveOrientationTo(page, 78, 2.5, "CLOSE");

    // Locked: roll 0.5°, pitch 12° down → hold 1s → captured.
    await driveOrientationTo(page, 78, 0.5, "LOCKED");
    // Lock-hold debounce is 1s; allow slack for dev-server contention.
    await expect(page.getByTestId("captured-step")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("captured-step")).toContainText("Do not move the tripod");
  });

  test("gyro-denied path: manual confirm fallback reaches capture (never blocks)", async ({ page }) => {
    await mockBrowserApis(page, "denied");
    await page.goto("/dev/calibration-wizard");

    await page.getByRole("button", { name: "Shot put" }).click();
    await page.getByRole("button", { name: "Tripod is placed" }).click();
    await page.getByRole("button", { name: "Enable level assist" }).click();

    const manual = page.getByTestId("manual-level-confirm");
    await expect(manual).toBeVisible();
    await manual.click();
    await expect(page.getByTestId("captured-step")).toBeVisible({ timeout: 5000 });
  });
});
