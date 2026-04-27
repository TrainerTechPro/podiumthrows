import { describe, expect, test } from "vitest";
import { buildSnippet, scoreMatch, tokenizeQuery } from "../snippet";

describe("tokenizeQuery", () => {
  test("splits on whitespace and drops empties", () => {
    expect(tokenizeQuery("  hip  drive  ")).toEqual(["hip", "drive"]);
    expect(tokenizeQuery("")).toEqual([]);
    expect(tokenizeQuery("\t\n")).toEqual([]);
  });
});

describe("buildSnippet", () => {
  test("returns plain text when no tokens", () => {
    expect(buildSnippet("Hello world", "")).toEqual([{ text: "Hello world", marked: false }]);
  });

  test("flags case-insensitive token hits", () => {
    const segments = buildSnippet("She drove the Hip hard.", "hip");
    expect(segments).toEqual([
      { text: "She drove the ", marked: false },
      { text: "Hip", marked: true },
      { text: " hard.", marked: false },
    ]);
  });

  test("never emits raw HTML for special characters in source", () => {
    // The source contains <script> — every segment must remain text-only,
    // never re-encoded as HTML. The renderer turns each segment into a text
    // node, so the raw `<` is safe.
    const segments = buildSnippet("Coach said <script>alert(1)</script> hip drive", "hip");
    const joined = segments.map((s) => s.text).join("");
    expect(joined).toContain("<script>");
    expect(segments.find((s) => s.marked)?.text).toBe("hip");
  });

  test("windows around the match for long sources", () => {
    const long = "a".repeat(200) + " hip " + "b".repeat(200);
    const segments = buildSnippet(long, "hip", 60);
    const joined = segments.map((s) => s.text).join("");
    expect(joined.length).toBeLessThanOrEqual(80);
    expect(joined).toContain("…");
    expect(segments.find((s) => s.marked)?.text).toBe("hip");
  });

  test("multi-token queries highlight each token independently", () => {
    const segments = buildSnippet("teach hip drive sequencing", "hip drive");
    const marked = segments.filter((s) => s.marked).map((s) => s.text.toLowerCase());
    expect(marked).toContain("hip");
    expect(marked).toContain("drive");
  });

  test("escapes regex meta characters in the query", () => {
    // Should not throw on a query containing regex specials.
    const segments = buildSnippet("we discussed (a) and (b)", "(a)");
    expect(segments.find((s) => s.marked)?.text).toBe("(a)");
  });
});

describe("scoreMatch", () => {
  test("title hits outrank body hits at equal length/position", () => {
    const inTitle = scoreMatch({
      textLength: 100,
      matchOffset: 0,
      kindWeight: 1,
      titleHit: true,
    });
    const inBody = scoreMatch({
      textLength: 100,
      matchOffset: 0,
      kindWeight: 1,
      titleHit: false,
    });
    expect(inTitle).toBeGreaterThan(inBody);
  });

  test("earlier matches outrank later ones", () => {
    const a = scoreMatch({ textLength: 200, matchOffset: 5, kindWeight: 1 });
    const b = scoreMatch({ textLength: 200, matchOffset: 150, kindWeight: 1 });
    expect(a).toBeGreaterThan(b);
  });

  test("shorter sources outrank longer ones at the same offset", () => {
    const short = scoreMatch({ textLength: 30, matchOffset: 5, kindWeight: 1 });
    const long = scoreMatch({ textLength: 1000, matchOffset: 5, kindWeight: 1 });
    expect(short).toBeGreaterThan(long);
  });

  test("kindWeight scales the final score", () => {
    const heavy = scoreMatch({ textLength: 100, matchOffset: 0, kindWeight: 1.5 });
    const light = scoreMatch({ textLength: 100, matchOffset: 0, kindWeight: 0.5 });
    expect(heavy).toBeCloseTo(light * 3);
  });
});
