import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getCoachNavSections, type NavItem, type NavSection } from "@/components/ui/Sidebar";

const APP_ROOT = path.join(process.cwd(), "src", "app", "(dashboard)");
const NEXT_CONFIG_PATH = path.join(process.cwd(), "next.config.mjs");

/**
 * Parse every `source: '...'` string from next.config.mjs redirects. Sidebar
 * hrefs that point at a config-redirected URL (e.g. /coach/invitations →
 * /coach/athletes/invitations) are valid navigation targets even without a
 * page.tsx at the source path.
 */
function getRedirectSources(): Set<string> {
  const src = fs.readFileSync(NEXT_CONFIG_PATH, "utf8");
  const out = new Set<string>();
  for (const match of src.matchAll(/source:\s*['"]([^'"]+)['"]/g)) {
    out.add(match[1]);
  }
  return out;
}

/** Walk a nav-section array (including nested children) into a flat list of items. */
function flattenNav(sections: NavSection[]): NavItem[] {
  const out: NavItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      out.push(item);
      if (item.children) {
        for (const child of item.children) out.push(child);
      }
    }
  }
  return out;
}

/**
 * Map a sidebar href to the absolute path of its expected page.tsx.
 * Note: this does NOT handle dynamic segments like /foo/[id] — none of the
 * current sidebar hrefs use them, so we keep the resolver simple. If a future
 * sidebar item points at a dynamic route, this resolver will need to be
 * extended to glob-match the segment.
 */
function routeToPagePath(href: string): string {
  // Strip query string (?tab=…) and hash (#anchor) — both map to the same
  // page.tsx as the bare path, but fs.existsSync wouldn't find them.
  const pathOnly = href.split(/[?#]/)[0];
  const clean = pathOnly.startsWith("/") ? pathOnly.slice(1) : pathOnly;
  return path.join(APP_ROOT, clean, "page.tsx");
}

function checkSidebar(name: string, sections: NavSection[]) {
  const items = flattenNav(sections);
  const missing: string[] = [];
  const redirectSources = getRedirectSources();

  for (const item of items) {
    if (!item.href) continue;
    // Skip external and protocol-prefixed links.
    if (item.href.startsWith("http") || item.href.startsWith("mailto:")) continue;

    const pathOnly = item.href.split(/[?#]/)[0];

    // Valid if (a) page.tsx exists, OR (b) the path is a redirect source
    // in next.config.mjs. Both resolve for the end user.
    const target = routeToPagePath(item.href);
    if (fs.existsSync(target)) continue;
    if (redirectSources.has(pathOnly)) continue;

    missing.push(
      `${item.label} → ${item.href} (expected at ${target} or as a next.config redirect source)`
    );
  }

  if (missing.length > 0) {
    throw new Error(`${name} has ${missing.length} broken href(s):\n  ${missing.join("\n  ")}`);
  }
}

describe("sidebar href resolution (regression guard)", () => {
  // Athlete nav is BottomTabBar.tsx (mobile-native, no sidebar). The five
  // tab hrefs are hand-coded and asserted by sibling tab tests.
  it("every coach nav href resolves to an existing page.tsx (video flag off)", () => {
    checkSidebar("COACH_NAV_SECTIONS", getCoachNavSections({ videoAnalysisEnabled: false }));
  });

  it("every coach nav href resolves to an existing page.tsx (video flag on)", () => {
    checkSidebar(
      "COACH_NAV_SECTIONS (+video)",
      getCoachNavSections({ videoAnalysisEnabled: true })
    );
  });
});
