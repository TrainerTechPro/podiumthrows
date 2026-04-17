import { describe, it, expect } from "vitest";
import { isMeetComplete } from "../trigger";

type S = { round: "PRELIM" | "FINALS"; attemptInRound: number };

describe("isMeetComplete", () => {
  it("FOUR_STRAIGHT complete with 4 prelims in any order", () => {
    const throws: S[] = [
      { round: "PRELIM", attemptInRound: 3 },
      { round: "PRELIM", attemptInRound: 1 },
      { round: "PRELIM", attemptInRound: 4 },
      { round: "PRELIM", attemptInRound: 2 },
    ];
    expect(isMeetComplete("FOUR_STRAIGHT", null, throws)).toBe(true);
  });

  it("FOUR_STRAIGHT not complete with 3 prelims", () => {
    const throws: S[] = [1, 2, 3].map((n) => ({ round: "PRELIM" as const, attemptInRound: n }));
    expect(isMeetComplete("FOUR_STRAIGHT", null, throws)).toBe(false);
  });

  it("THREE_PLUS_THREE with madeFinals=false is complete after 3 prelims", () => {
    const throws: S[] = [1, 2, 3].map((n) => ({ round: "PRELIM" as const, attemptInRound: n }));
    expect(isMeetComplete("THREE_PLUS_THREE", false, throws)).toBe(true);
    expect(isMeetComplete("THREE_PLUS_THREE", null, throws)).toBe(true);
  });

  it("THREE_PLUS_THREE with madeFinals=true requires finals too", () => {
    const prelimsOnly: S[] = [1, 2, 3].map((n) => ({
      round: "PRELIM" as const,
      attemptInRound: n,
    }));
    expect(isMeetComplete("THREE_PLUS_THREE", true, prelimsOnly)).toBe(false);

    const full: S[] = [
      ...prelimsOnly,
      { round: "FINALS", attemptInRound: 1 },
      { round: "FINALS", attemptInRound: 2 },
      { round: "FINALS", attemptInRound: 3 },
    ];
    expect(isMeetComplete("THREE_PLUS_THREE", true, full)).toBe(true);
  });

  it("THREE_PLUS_THREE missing a prelim is not complete even with all finals", () => {
    const throws: S[] = [
      { round: "PRELIM", attemptInRound: 1 },
      { round: "PRELIM", attemptInRound: 2 },
      { round: "FINALS", attemptInRound: 1 },
      { round: "FINALS", attemptInRound: 2 },
      { round: "FINALS", attemptInRound: 3 },
    ];
    expect(isMeetComplete("THREE_PLUS_THREE", true, throws)).toBe(false);
  });
});
