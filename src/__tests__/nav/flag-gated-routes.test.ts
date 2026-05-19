import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { FLAG_GATED_ROUTES } from "@/lib/flag-gated-routes";

const APP_ROOT = path.join(process.cwd(), "src", "app", "(dashboard)");

/**
 * Every flag-gated prefix in the middleware must point at a real app
 * directory — otherwise the middleware silently does nothing for that
 * entry and the contract drifts. See tasks/navigation-contract-2026-05-18.md
 * §"Hidden / flag-gated modules".
 */
describe("flag-gated routes (regression guard)", () => {
  it("every FLAG_GATED_ROUTES prefix maps to an existing app directory", () => {
    const missing: string[] = [];
    for (const { prefix, flag } of FLAG_GATED_ROUTES) {
      const rel = prefix.startsWith("/") ? prefix.slice(1) : prefix;
      const dir = path.join(APP_ROOT, rel);
      if (!fs.existsSync(dir)) {
        missing.push(`${flag} → ${prefix} (expected directory at ${dir})`);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Stale FLAG_GATED_ROUTES entries (gated route no longer exists):\n  ${missing.join("\n  ")}`
      );
    }
  });
});
