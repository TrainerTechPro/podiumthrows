import { describe, it, expect } from "vitest";
import { mergePrefill, isAbsent, answersArrayToMap } from "@/lib/forms/prefill";

describe("isAbsent", () => {
  it("treats undefined/null/'' /[] as absent", () => {
    expect(isAbsent(undefined)).toBe(true);
    expect(isAbsent(null)).toBe(true);
    expect(isAbsent("")).toBe(true);
    expect(isAbsent([])).toBe(true);
  });

  it("preserves 0 and false as present (CLAUDE.md rule 3)", () => {
    expect(isAbsent(0)).toBe(false);
    expect(isAbsent(false)).toBe(false);
  });

  it("treats non-empty strings/arrays/objects as present", () => {
    expect(isAbsent("a")).toBe(false);
    expect(isAbsent([1])).toBe(false);
    expect(isAbsent({})).toBe(false);
  });
});

describe("mergePrefill", () => {
  const knownIds = ["q1", "q2", "q3"];

  it("first-time fill: previous=null returns empty merged + no prefilled ids", () => {
    const result = mergePrefill({
      draft: null,
      previous: null,
      knownIds,
      useToggle: true,
    });
    expect(result.merged).toEqual({});
    expect(result.prefilledIds.size).toBe(0);
  });

  it("applies previous answers to empty draft when toggle is on", () => {
    const result = mergePrefill({
      draft: {},
      previous: { q1: "Yes", q2: 7 },
      knownIds,
      useToggle: true,
    });
    expect(result.merged).toEqual({ q1: "Yes", q2: 7 });
    expect(result.prefilledIds).toEqual(new Set(["q1", "q2"]));
  });

  it("does NOT apply previous answers when toggle is off", () => {
    const result = mergePrefill({
      draft: {},
      previous: { q1: "Yes", q2: 7 },
      knownIds,
      useToggle: false,
    });
    expect(result.merged).toEqual({});
    expect(result.prefilledIds.size).toBe(0);
  });

  it("draft wins over previous (precedence)", () => {
    const result = mergePrefill({
      draft: { q1: "No" },
      previous: { q1: "Yes", q2: 7 },
      knownIds,
      useToggle: true,
    });
    expect(result.merged).toEqual({ q1: "No", q2: 7 });
    // q1 came from draft, so it's NOT prefilled.
    expect(result.prefilledIds).toEqual(new Set(["q2"]));
  });

  it("preserves 0 from draft (does not fall through to previous)", () => {
    const result = mergePrefill({
      draft: { q1: 0 },
      previous: { q1: 10 },
      knownIds,
      useToggle: true,
    });
    expect(result.merged.q1).toBe(0);
    expect(result.prefilledIds.has("q1")).toBe(false);
  });

  it("falls through to previous when draft has empty string", () => {
    const result = mergePrefill({
      draft: { q1: "" },
      previous: { q1: "Yes" },
      knownIds,
      useToggle: true,
    });
    expect(result.merged.q1).toBe("Yes");
    expect(result.prefilledIds.has("q1")).toBe(true);
  });

  it("ignores previous answers for ids not in current form definition", () => {
    const result = mergePrefill({
      draft: {},
      previous: { q1: "Yes", removedId: "old data" },
      knownIds: ["q1"],
      useToggle: true,
    });
    expect(result.merged).toEqual({ q1: "Yes" });
    expect("removedId" in result.merged).toBe(false);
  });

  it("preserves draft entries for unknown ids (don't silently lose user input)", () => {
    const result = mergePrefill({
      draft: { q1: "draft-val", strayId: "user typed this" },
      previous: {},
      knownIds: ["q1"],
      useToggle: true,
    });
    expect(result.merged.q1).toBe("draft-val");
    expect(result.merged.strayId).toBe("user typed this");
  });

  it("handles array answers (multi-choice)", () => {
    const result = mergePrefill({
      draft: {},
      previous: { q1: ["a", "b"] },
      knownIds: ["q1"],
      useToggle: true,
    });
    expect(result.merged.q1).toEqual(["a", "b"]);
    expect(result.prefilledIds.has("q1")).toBe(true);
  });

  it("does not prefill when previous value is absent", () => {
    const result = mergePrefill({
      draft: {},
      previous: { q1: null, q2: "", q3: [] },
      knownIds,
      useToggle: true,
    });
    expect(result.merged).toEqual({});
    expect(result.prefilledIds.size).toBe(0);
  });
});

describe("answersArrayToMap", () => {
  it("normalizes block-array answers to {id: answer} map", () => {
    const answers = [
      { blockId: "b1", blockLabel: "Mood", answer: 7 },
      { blockId: "b2", blockLabel: "Soreness", answer: "Yes" },
    ];
    expect(answersArrayToMap(answers)).toEqual({ b1: 7, b2: "Yes" });
  });

  it("normalizes legacy question-array answers to {id: answer} map", () => {
    const answers = [
      { questionId: "q1", questionText: "Mood", answer: 5 },
      { questionId: "q2", questionText: "Pain", answer: "No" },
    ];
    expect(answersArrayToMap(answers)).toEqual({ q1: 5, q2: "No" });
  });

  it("returns empty map for non-array input", () => {
    expect(answersArrayToMap(null)).toEqual({});
    expect(answersArrayToMap(undefined)).toEqual({});
    expect(answersArrayToMap("garbage")).toEqual({});
    expect(answersArrayToMap({})).toEqual({});
  });

  it("skips entries with absent values", () => {
    const answers = [
      { blockId: "b1", answer: null },
      { blockId: "b2", answer: "" },
      { blockId: "b3", answer: [] },
      { blockId: "b4", answer: 0 }, // 0 is preserved
      { blockId: "b5", answer: "ok" },
    ];
    expect(answersArrayToMap(answers)).toEqual({ b4: 0, b5: "ok" });
  });

  it("skips entries missing an id", () => {
    const answers = [
      { answer: "no id" },
      { blockId: "", answer: "empty id" },
      { blockId: "b1", answer: "valid" },
    ];
    expect(answersArrayToMap(answers)).toEqual({ b1: "valid" });
  });
});
