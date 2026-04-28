import { type Page, type BrowserContext } from "@playwright/test";

export const ATHLETE_1 = { email: "athlete1@example.com", password: "athlete123" } as const;
export const COACH = { email: "coach@example.com", password: "coach123" } as const;

/**
 * Log in via the UI and return the authenticated page.
 * Uses the login form so the CSRF cookie flow is exercised.
 */
export async function login(
  page: Page,
  email: string = COACH.email,
  password: string = COACH.password
): Promise<Page> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15000,
  });
  return page;
}

export async function loginAsAthlete(page: Page): Promise<Page> {
  return login(page, ATHLETE_1.email, ATHLETE_1.password);
}

/**
 * Log in via API and inject cookies into the browser context.
 * Faster than UI login — use for tests that don't test the login flow itself.
 */
export async function loginViaAPI(
  context: BrowserContext,
  baseURL: string,
  email = "coach@example.com",
  password = "coach123"
): Promise<void> {
  // First load a page so the CSRF cookie gets set by middleware
  const page = await context.newPage();
  await page.goto("/login");
  const cookies = await context.cookies();
  const csrfToken = cookies.find((c) => c.name === "csrf-token")?.value ?? "";

  const response = await page.request.post(`${baseURL}/api/auth/login`, {
    data: { email, password },
    headers: { "X-CSRF-Token": csrfToken },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  await page.close();
}
