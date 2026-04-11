import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ATHLETE_NAV_SECTIONS,
  COACH_NAV_SECTIONS,
  type NavItem,
  type NavSection,
} from "@/components/ui/Sidebar";

const APP_ROOT = path.join(process.cwd(), "src", "app", "(dashboard)");

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
  const clean = href.startsWith("/") ? href.slice(1) : href;
  return path.join(APP_ROOT, clean, "page.tsx");
}

function checkSidebar(name: string, sections: NavSection[]) {
  const items = flattenNav(sections);
  const missing: string[] = [];

  for (const item of items) {
    if (!item.href) continue;
    // Skip external and protocol-prefixed links.
    if (item.href.startsWith("http") || item.href.startsWith("mailto:")) continue;

    const target = routeToPagePath(item.href);
    if (!fs.existsSync(target)) {
      missing.push(`${item.label} → ${item.href} (expected at ${target})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `${name} has ${missing.length} broken href(s):\n  ${missing.join("\n  ")}`
    );
  }
}

describe("sidebar href resolution (regression guard)", () => {
  it("every athlete nav href resolves to an existing page.tsx", () => {
    checkSidebar("ATHLETE_NAV_SECTIONS", ATHLETE_NAV_SECTIONS);
  });

  it("every coach nav href resolves to an existing page.tsx", () => {
    checkSidebar("COACH_NAV_SECTIONS", COACH_NAV_SECTIONS);
  });
});
