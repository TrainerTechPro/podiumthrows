import { test, expect } from "@playwright/test";

// Auth comes from the "coach" project's storageState.

test.describe("Coach Dashboard", () => {
  test("coach sees dashboard content after login", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await expect(page).toHaveURL(/\/coach\/dashboard/);
    // Editorial coach dashboard headline — no greeting ceremony here,
    // per Dual Product Identity (research-software register).
    await expect(page.getByRole("heading", { name: "Your program, today." })).toBeVisible();
  });

  // Sidebar navigation is scoped via aria-label="Sidebar navigation" on the
  // <aside>. Targeting the sidebar by-label and then by exact role+name
  // beats the previous regex-first-match-on-whole-page pattern, which broke
  // every time a new top-bar icon, dashboard card, or athlete link happened
  // to match. See tasks/lessons.md (commit 4.5 incident) and the
  // <button>-vs-<Link> distinction for collapsible nav parents.

  test("coach can navigate to athletes page from sidebar", async ({ page }) => {
    await page.goto("/coach/dashboard");
    const sidebar = page.getByLabel("Sidebar navigation");
    // Athletes parent has children, so it renders as a <button> that expands —
    // it doesn't navigate. Click to expand, then click the Roster leaf link.
    await sidebar.getByRole("button", { name: "Athletes" }).click();
    await sidebar.getByRole("link", { name: "Roster", exact: true }).click();
    await expect(page).toHaveURL(/\/coach\/athletes(\?|$|#)/);
  });

  test("coach can navigate to library from sidebar", async ({ page }) => {
    await page.goto("/coach/dashboard");
    const sidebar = page.getByLabel("Sidebar navigation");
    // Library is a leaf nav item — single click navigates.
    await sidebar.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/coach\/library(\?|$|#)/);
  });

  test("coach can navigate to calendar from sidebar", async ({ page }) => {
    await page.goto("/coach/dashboard");
    const sidebar = page.getByLabel("Sidebar navigation");
    await sidebar.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page).toHaveURL(/\/coach\/calendar(\?|$|#)/);
  });

  test("coach can navigate to builder from sidebar", async ({ page }) => {
    await page.goto("/coach/dashboard");
    const sidebar = page.getByLabel("Sidebar navigation");
    await sidebar.getByRole("link", { name: "Builder", exact: true }).click();
    await expect(page).toHaveURL(/\/coach\/builder(\?|$|#)/);
  });

  // ── MVP weekly loop ───────────────────────────────────────────────────
  // The "This week" surface is the coach side of the weekly loop. Every
  // tile must be present, and tiles with positive counts must link to a
  // filtered surface. See tasks/mvp-weekly-loop.md.

  test("coach dashboard surfaces 'This week' with five tiles", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await expect(page.getByRole("heading", { name: "This week" })).toBeVisible();
    for (const label of [
      "Not started",
      "Completed",
      "PRs this week",
      "Missing readiness",
      "Needs review",
    ]) {
      // Tile label appears once inside the "This week" section.
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("meta-bar 'athletes' count links to roster", async ({ page }) => {
    await page.goto("/coach/dashboard");
    await page
      .getByRole("link", { name: /\d+ athletes? — open roster/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/coach\/athletes(\?|$|#)/);
  });

  test("calendar filter URL renders the from-dashboard banner", async ({ page }) => {
    await page.goto("/coach/calendar?filter=not-started");
    await expect(page.getByTestId("calendar-filter-banner")).toBeVisible();
    await expect(page.getByText(/Assigned this week, not started/)).toBeVisible();
  });

  test("roster filter URL renders the active-filter banner", async ({ page }) => {
    await page.goto("/coach/athletes?filter=missing-readiness");
    await expect(page.getByText(/Filtered:/)).toBeVisible();
    await expect(
      page.getByText(/Athletes with no readiness check-in in the last 7 days/)
    ).toBeVisible();
  });
});
