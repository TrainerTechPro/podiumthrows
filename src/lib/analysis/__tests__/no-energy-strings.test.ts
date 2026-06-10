import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * F6 lint gate: "No '% energy lost' figures anywhere — unmeasurable, banned."
 * Greps every Video Analysis 2.0 surface for energy-percentage language.
 *
 * The legacy ThrowFlow module (src/lib/throwflow, src/app/api/throwflow,
 * src/components/video-analysis) is intentionally NOT scanned — it is the
 * quarantined predecessor this module replaces (decisions.md D11) and its
 * removal is tracked in docs/build-log.md TODO.
 */

const SCANNED_DIRS = [
  "src/lib/analysis",
  "src/lib/contracts",
  "src/components/analysis",
  "src/app/api/analysis",
  "services",
];

const BANNED_PATTERNS = [
  "% energy",
  "percent energy",
  "energy leak",
  "energyLeak",
  "percentImpact",
  "energy lost",
  "% efficiency",
];

/**
 * Files allowed to contain the banned phrases ONLY because they state or
 * test the prohibition itself — none of them can display a figure:
 *  - this test file (the patterns list)
 *  - contracts/faults.ts (doc comment quoting the PRD ban)
 *  - narrative/claude.ts (the system-prompt rule forbidding the model)
 *  - narrative tests (fixtures that must be REJECTED by the validator)
 */
const PROHIBITION_ALLOWLIST = [
  "no-energy-strings.test.ts",
  "src/lib/contracts/faults.ts",
  "src/lib/analysis/narrative/claude.ts",
  "src/lib/analysis/narrative/__tests__/narrative.test.ts",
];

describe("banned physics-theater strings (F6)", () => {
  const repoRoot = path.resolve(__dirname, "../../../..");

  for (const pattern of BANNED_PATTERNS) {
    it(`"${pattern}" appears nowhere in VA2 surfaces`, () => {
      for (const dir of SCANNED_DIRS) {
        let out = "";
        try {
          out = execFileSync(
            "grep",
            ["-r", "-i", "-l", pattern, path.join(repoRoot, dir)],
            { encoding: "utf8" }
          );
        } catch {
          out = ""; // ok: grep exits 1 when nothing matches — that IS the pass case
        }
        const hits = out
          .split("\n")
          .filter(Boolean)
          .filter((f) => !PROHIBITION_ALLOWLIST.some((a) => f.endsWith(a) || f.includes(a)));
        expect(hits, `${pattern} found in ${dir}:\n${hits.join("\n")}`).toEqual([]);
      }
    });
  }
});
