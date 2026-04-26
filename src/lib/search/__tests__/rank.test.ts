import { describe, it, expect } from "vitest";
import { rankResults } from "../rank";

interface Athlete {
  id: string;
  name: string;
  event?: string;
}

const ATHLETES: Athlete[] = [
  { id: "1", name: "Jamie Carter", event: "Hammer" },
  { id: "2", name: "Carter Jamie-Lee", event: "Discus" },
  { id: "3", name: "Marcus Holt", event: "Shot Put" },
  { id: "4", name: "Jamilla Ross", event: "Javelin" },
  { id: "5", name: "Reggie James", event: "Hammer" },
];

const fields = (a: Athlete) => [a.name, a.event ?? ""];

describe("rankResults", () => {
  it("returns empty for empty/whitespace query", () => {
    expect(rankResults(ATHLETES, "", fields)).toEqual([]);
    expect(rankResults(ATHLETES, "   ", fields)).toEqual([]);
  });

  it("returns empty when given no items", () => {
    expect(rankResults([], "jamie", fields)).toEqual([]);
  });

  it("ranks exact prefix matches above substring matches", () => {
    const ranked = rankResults(ATHLETES, "jamie", fields);
    const top = ranked[0];
    expect(top.matchType).toBe("prefix");
    expect((top.item as Athlete).name).toBe("Jamie Carter");

    // "Carter Jamison" contains "jami" as substring — should appear, but after
    // any prefix matches.
    const carterJ = ranked.find((r) => (r.item as Athlete).id === "2");
    expect(carterJ?.matchType).toBe("substring");
    const jamie = ranked.find((r) => (r.item as Athlete).id === "1");
    expect((jamie?.score ?? 99) < (carterJ?.score ?? 99)).toBe(true);
  });

  it("ranks substring matches above fuzzy matches", () => {
    const ranked = rankResults(ATHLETES, "carter", fields);
    const scores = ranked.map((r) => r.matchType);
    // First "Carter ..." or "... Carter" hits should be prefix or substring,
    // never fuzzy.
    expect(scores[0]).toMatch(/prefix|substring/);

    // No fuzzy result should outrank a substring match.
    let lastNonFuzzyScore = -Infinity;
    for (const r of ranked) {
      if (r.matchType !== "fuzzy") lastNonFuzzyScore = Math.max(lastNonFuzzyScore, r.score);
      if (r.matchType === "fuzzy") expect(r.score).toBeGreaterThan(lastNonFuzzyScore);
    }
  });

  it("includes fuzzy matches when query has typos", () => {
    // "marcs" (missing 'u') should still surface "Marcus" via fuzzy
    const ranked = rankResults(ATHLETES, "marcs", fields);
    const marcus = ranked.find((r) => (r.item as Athlete).id === "3");
    expect(marcus).toBeDefined();
    expect(marcus?.matchType).toBe("fuzzy");
  });

  it("matches against any of the searchable fields", () => {
    // 'hammer' is in `event`, not `name` — but it's a searchable field.
    const ranked = rankResults(ATHLETES, "hammer", fields);
    const ids = ranked.map((r) => (r.item as Athlete).id);
    expect(ids).toContain("1");
    expect(ids).toContain("5");
  });

  it("is case-insensitive", () => {
    const lower = rankResults(ATHLETES, "jamie", fields);
    const upper = rankResults(ATHLETES, "JAMIE", fields);
    expect(lower.map((r) => (r.item as Athlete).id)).toEqual(
      upper.map((r) => (r.item as Athlete).id)
    );
  });

  it("orders prefix hits stably (preserves input order on ties)", () => {
    const items: Athlete[] = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Alpine" },
      { id: "c", name: "Alfresco" },
    ];
    const ranked = rankResults(items, "al", (it) => [it.name]);
    expect(ranked.every((r) => r.matchType === "prefix")).toBe(true);
    expect(ranked.map((r) => r.item.id)).toEqual(["a", "b", "c"]);
  });
});
