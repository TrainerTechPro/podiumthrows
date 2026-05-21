import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOTS = [
  path.join(process.cwd(), "src", "app"),
  path.join(process.cwd(), "src", "components"),
  path.join(process.cwd(), "src", "lib"),
];

const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function* walk(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      yield* walk(full);
      continue;
    }
    if (entry.isFile() && FILE_EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

describe("retired coach throws route links", () => {
  it("keeps active source off retired profile, invite, and hub CTAs", () => {
    const profileRoute = ["/coach/throws", "profile"].join("/");
    const inviteRoute = ["/coach/throws", "invite"].join("/");
    const retiredHubHrefPatterns = [
      'href="/coach/throws"',
      'href: "/coach/throws"',
      "href='/coach/throws'",
      "href: '/coach/throws'",
    ];

    const offenders: string[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const file of walk(root)) {
        const source = fs.readFileSync(file, "utf8");
        const hits = [profileRoute, inviteRoute, ...retiredHubHrefPatterns].filter((needle) =>
          source.includes(needle)
        );
        if (hits.length > 0) {
          offenders.push(`${path.relative(process.cwd(), file)}: ${hits.join(", ")}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
