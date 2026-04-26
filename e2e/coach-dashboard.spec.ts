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
});
